-- Saved instruments are user-owned suggestions. Historical trade symbols remain
-- independent text values and are never deleted with a saved instrument.
create table public.saved_instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index saved_instruments_user_normalized_name_key
  on public.saved_instruments (user_id,lower(name));

alter table public.saved_instruments enable row level security;

create policy saved_instruments_select_own
  on public.saved_instruments for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy saved_instruments_insert_own
  on public.saved_instruments for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy saved_instruments_update_own
  on public.saved_instruments for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy saved_instruments_delete_own
  on public.saved_instruments for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.saved_instruments from public,anon;
grant select,insert,update,delete on public.saved_instruments to authenticated;

-- `pnl` remains the compatibility field for realized Net Result. Existing
-- values are copied into Gross Result with zero commission so historical
-- balances and statistics remain byte-for-byte equivalent.
alter table public.trades
  add column "tradeTime" time without time zone,
  add column "grossPnl" numeric(24,8),
  add column commission numeric(24,8) not null default 0;

update public.trades set "grossPnl"=pnl where pnl is not null;

alter table public.trades
  add constraint trades_gross_pnl_range check ("grossPnl" between -1e12 and 1e12),
  add constraint trades_commission_range check (commission between -1e12 and 0);

-- Enforce Net = Gross + Commission at the database boundary. The legacy import
-- RPC may still insert only `pnl`; those rows are normalized to gross=pnl and
-- commission=0 without changing their realized result.
create function public.sync_trade_net_result()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new."grossPnl" is null and new.pnl is not null and tg_op='INSERT' then
    new."grossPnl" := new.pnl;
    new.commission := 0;
  elsif new."grossPnl" is null then
    new.commission := 0;
    new.pnl := null;
  else
    new.commission := -abs(coalesce(new.commission,0));
    new.pnl := new."grossPnl" + new.commission;
  end if;
  return new;
end $$;

revoke all on function public.sync_trade_net_result() from public,anon,authenticated;

create trigger sync_trade_net_result_trigger
before insert or update of "grossPnl",commission,pnl on public.trades
for each row execute function public.sync_trade_net_result();

-- Append fields so existing view consumers retain their column order.
create or replace view public.trade_records with (security_invoker=true) as
select id,user_id,"accountId",sequence,date,symbol,"riskPercent"::text,"rewardRisk"::text,
  duration,pnl::text,notes,feelings,"evidenceUrl",strategy,direction,session,tags,"sourceRow",version,
  "setupGrade",mindset,"evidencePath","additionalEvidenceUrls","additionalEvidencePaths",
  "tradeTime","grossPnl"::text,commission::text
from public.trades;

create or replace function public.save_trade(p_data jsonb, p_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a uuid := (p_data->>'accountId')::uuid; n integer; result_id uuid; result jsonb;
begin
  if auth.uid() is null then raise sqlstate '42501' using message='Authentication required'; end if;
  perform 1 from public.trading_accounts where id=a and user_id=auth.uid() for update;
  if not found then raise sqlstate 'P0002' using message='Account not found'; end if;
  if coalesce(p_data->>'strategy','') <> '' then
    insert into public.strategies(user_id,name) values(auth.uid(),p_data->>'strategy') on conflict(user_id,name) do nothing;
  end if;
  if p_id is null then
    update public.trading_accounts set last_sequence=greatest(last_sequence,
      coalesce((select max(sequence) from public.trades where "accountId"=a),0))+1
      where id=a returning last_sequence into n;
    insert into public.trades(user_id,"accountId",sequence) values(auth.uid(),a,n) returning id into result_id;
  else
    select id into result_id from public.trades
      where id=p_id and "accountId"=a and user_id=auth.uid() and version=(p_data->>'version')::integer for update;
    if not found then raise sqlstate 'PT409' using message='Operation changed or removed'; end if;
  end if;
  update public.trades set date=nullif(p_data->>'date','')::date,
    "tradeTime"=nullif(p_data->>'tradeTime','')::time,
    symbol=coalesce(p_data->>'symbol',''), "riskPercent"=nullif(p_data->>'riskPercent','')::numeric,
    "rewardRisk"=nullif(p_data->>'rewardRisk','')::numeric, duration=nullif(p_data->>'duration','')::numeric,
    "grossPnl"=coalesce(nullif(p_data->>'grossPnl','')::numeric,nullif(p_data->>'pnl','')::numeric),
    commission=case when coalesce(nullif(p_data->>'grossPnl',''),nullif(p_data->>'pnl','')) is null then 0 else -abs(coalesce(nullif(p_data->>'commission','')::numeric,0)) end,
    notes=coalesce(p_data->>'notes',''), feelings=coalesce(p_data->>'feelings',''),
    "evidenceUrl"=coalesce(p_data->>'evidenceUrl',''),
    "additionalEvidenceUrls"=case when p_data ? 'additionalEvidenceUrls' then
      coalesce((select array_agg(value order by ord) from
        jsonb_array_elements_text(p_data->'additionalEvidenceUrls') with ordinality as links(value,ord)),array[]::text[])
      else "additionalEvidenceUrls" end,
    strategy=coalesce(p_data->>'strategy',''), "setupGrade"=coalesce(p_data->>'setupGrade',''),
    mindset=coalesce(p_data->>'mindset',''), direction=coalesce(p_data->>'direction',''),
    session=coalesce(p_data->>'session',''),tags=coalesce(p_data->>'tags',''),
    version=case when p_id is null then 1 else version+1 end,updated_at=now()
    where id=result_id;
  select to_jsonb(r) into result from public.trade_records r where id=result_id;
  return result;
end $$;

revoke all on function public.save_trade(jsonb,uuid) from public,anon;
grant execute on function public.save_trade(jsonb,uuid) to authenticated;

-- Add only privacy-minimal product events. Saved instrument names and article
-- URLs/titles never enter analytics; the optional news category is enum-like.
alter table public.analytics_events drop constraint analytics_events_pair_check;
alter table public.analytics_events add constraint analytics_events_pair_check check (
  (feature = 'overview' and event_name in ('overview_viewed', 'pdf_exported'))
  or (feature = 'trading_journal' and event_name in ('journal_viewed', 'trade_created', 'trade_updated', 'trade_deleted', 'instrument_saved'))
  or (feature = 'statistics' and event_name in ('statistics_viewed', 'statistics_filter_changed', 'statistics_pdf_exported'))
  or (feature = 'calendar' and event_name in ('calendar_viewed', 'calendar_day_opened'))
  or (feature = 'monte_carlo' and event_name in ('monte_carlo_viewed', 'simulation_run'))
  or (feature = 'funded_accounts' and event_name = 'funded_accounts_viewed')
  or (feature = 'news' and event_name in ('news_viewed', 'news_filter_changed', 'news_article_opened'))
  or (feature = 'review' and event_name in ('review_viewed', 'review_submitted'))
  or (feature = 'trade_sharing' and event_name in ('trade_share_created', 'trade_share_revoked'))
);

create or replace function public.record_analytics_event(
  p_feature text,
  p_event_name text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_key text;
  v_simulation_size numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_metadata) <> 'object' or pg_column_size(v_metadata) > 512 then
    raise exception 'Invalid analytics metadata' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(v_metadata) loop
    if v_key not in ('export_type', 'filter_name', 'simulation_size', 'category') then
      raise exception 'Unsupported analytics metadata key' using errcode = '22023';
    end if;
  end loop;

  if v_metadata ? 'export_type' then
    if p_feature <> 'overview' or p_event_name <> 'pdf_exported'
       or jsonb_typeof(v_metadata->'export_type') <> 'string'
       or v_metadata->>'export_type' <> 'account_pdf' then
      raise exception 'Invalid analytics export metadata' using errcode = '22023';
    end if;
  end if;
  if v_metadata ? 'filter_name' then
    if p_feature <> 'news' or p_event_name <> 'news_filter_changed'
       or jsonb_typeof(v_metadata->'filter_name') <> 'string'
       or v_metadata->>'filter_name' not in ('currency', 'country', 'category', 'search') then
      raise exception 'Invalid analytics filter metadata' using errcode = '22023';
    end if;
  end if;
  if v_metadata ? 'category' then
    if p_feature <> 'news' or p_event_name <> 'news_article_opened'
       or jsonb_typeof(v_metadata->'category') <> 'string'
       or v_metadata->>'category' not in ('latest', 'stocks', 'forex', 'crypto') then
      raise exception 'Invalid analytics category metadata' using errcode = '22023';
    end if;
  end if;
  if v_metadata ? 'simulation_size' then
    if p_feature <> 'monte_carlo' or p_event_name <> 'simulation_run'
       or jsonb_typeof(v_metadata->'simulation_size') <> 'number' then
      raise exception 'Invalid analytics simulation metadata' using errcode = '22023';
    end if;
    v_simulation_size := (v_metadata->>'simulation_size')::numeric;
    if v_simulation_size < 1 or v_simulation_size > 1000 or mod(v_simulation_size, 1) <> 0 then
      raise exception 'Invalid analytics simulation metadata' using errcode = '22023';
    end if;
  end if;

  insert into public.analytics_events (user_id, feature, event_name, metadata)
  values (v_user_id, p_feature, p_event_name, v_metadata);
end;
$$;

revoke all on function public.record_analytics_event(text, text, jsonb) from public,anon;
grant execute on function public.record_analytics_event(text, text, jsonb) to authenticated;

-- Aggregate news telemetry separately so the existing admin payload remains
-- backward compatible and raw events stay inaccessible to browser clients.
create function public.get_admin_news_analytics(p_range text default '30d')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_start timestamptz;
  v_result jsonb;
begin
  if v_actor is null or not private.is_full_admin(v_actor) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_range not in ('7d','30d','90d','all') then
    raise exception 'Invalid analytics range' using errcode = '22023';
  end if;
  v_start := case p_range
    when '7d' then now() - interval '7 days'
    when '30d' then now() - interval '30 days'
    when '90d' then now() - interval '90 days'
    else null
  end;

  with news_events as (
    select user_id,event_name,metadata from public.analytics_events
    where feature='news' and (v_start is null or created_at>=v_start)
  ), category_rows as (
    select metadata->>'category' category,count(*)::integer opens
    from news_events
    where event_name='news_article_opened' and metadata->>'category' in ('latest','stocks','forex','crypto')
    group by metadata->>'category'
  ), totals as (
    select
      count(*) filter (where event_name='news_viewed')::integer views,
      count(*) filter (where event_name='news_article_opened')::integer article_opens,
      count(distinct user_id) filter (where event_name='news_article_opened')::integer unique_readers
    from news_events
  )
  select jsonb_build_object(
    'views',t.views,
    'articleOpens',t.article_opens,
    'uniqueReaders',t.unique_readers,
    'engagementPercent',case when t.views=0 then 0 else round(t.article_opens::numeric*100/t.views,1) end,
    'categories',coalesce((select jsonb_agg(jsonb_build_object('category',c.category,'opens',c.opens) order by c.opens desc,c.category) from category_rows c),'[]'::jsonb)
  ) into v_result from totals t;
  return v_result;
end;
$$;

revoke all on function public.get_admin_news_analytics(text) from public,anon;
grant execute on function public.get_admin_news_analytics(text) to authenticated;
