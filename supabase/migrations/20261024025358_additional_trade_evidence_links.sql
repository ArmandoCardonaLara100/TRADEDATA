-- Preserve the original evidenceUrl as link 1. The array holds links 2-4 in
-- stable positions, so existing operations require no backfill or rewriting.
alter table public.trades
  add column "additionalEvidenceUrls" text[] not null default array[]::text[]
  constraint trades_additional_evidence_urls_check
  check (cardinality("additionalEvidenceUrls") <= 3 and length(array_to_string("additionalEvidenceUrls", '')) <= 6144);

-- HTTP links are permitted for existing private chart services; the UI opens
-- them in a new, non-opener tab. The previous constraint allowed HTTPS only.
alter table public.trades drop constraint "trades_evidenceUrl_check";
alter table public.trades add constraint "trades_evidenceUrl_check"
  check ("evidenceUrl" = '' or "evidenceUrl" ~* '^https?://');

-- Append the new column so existing view consumers retain their column order.
create or replace view public.trade_records with (security_invoker=true) as
select id,user_id,"accountId",sequence,date,symbol,"riskPercent"::text,"rewardRisk"::text,
  duration,pnl::text,notes,feelings,"evidenceUrl",strategy,direction,session,tags,"sourceRow",version,
  "setupGrade",mindset,"evidencePath","additionalEvidenceUrls"
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
    symbol=coalesce(p_data->>'symbol',''), "riskPercent"=nullif(p_data->>'riskPercent','')::numeric,
    "rewardRisk"=nullif(p_data->>'rewardRisk','')::numeric, duration=nullif(p_data->>'duration','')::numeric,
    pnl=nullif(p_data->>'pnl','')::numeric, notes=coalesce(p_data->>'notes',''),
    feelings=coalesce(p_data->>'feelings',''), "evidenceUrl"=coalesce(p_data->>'evidenceUrl',''),
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
