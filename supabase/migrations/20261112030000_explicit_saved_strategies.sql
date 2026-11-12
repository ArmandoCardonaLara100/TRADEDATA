-- Strategies are reusable only when the user explicitly saves them. A custom
-- strategy on an operation remains valid without being added to suggestions.
create or replace function public.save_trade(p_data jsonb, p_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a uuid := (p_data->>'accountId')::uuid; n integer; result_id uuid; result jsonb;
begin
  if auth.uid() is null then raise sqlstate '42501' using message='Authentication required'; end if;
  perform 1 from public.trading_accounts where id=a and user_id=auth.uid() for update;
  if not found then raise sqlstate 'P0002' using message='Account not found'; end if;
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

alter table public.analytics_events drop constraint analytics_events_pair_check;
alter table public.analytics_events add constraint analytics_events_pair_check check (
  (feature = 'overview' and event_name in ('overview_viewed', 'pdf_exported'))
  or (feature = 'trading_journal' and event_name in ('journal_viewed', 'trade_created', 'trade_updated', 'trade_deleted', 'instrument_saved', 'strategy_saved'))
  or (feature = 'statistics' and event_name in ('statistics_viewed', 'statistics_filter_changed', 'statistics_pdf_exported'))
  or (feature = 'calendar' and event_name in ('calendar_viewed', 'calendar_day_opened'))
  or (feature = 'monte_carlo' and event_name in ('monte_carlo_viewed', 'simulation_run'))
  or (feature = 'funded_accounts' and event_name = 'funded_accounts_viewed')
  or (feature = 'news' and event_name in ('news_viewed', 'news_filter_changed', 'news_article_opened'))
  or (feature = 'review' and event_name in ('review_viewed', 'review_submitted'))
  or (feature = 'trade_sharing' and event_name in ('trade_share_created', 'trade_share_revoked'))
);
