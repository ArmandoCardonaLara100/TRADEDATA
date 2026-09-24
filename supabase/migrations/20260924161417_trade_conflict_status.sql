-- Business conflicts must not use retryable serialization_failure (40001).
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
    strategy=coalesce(p_data->>'strategy',''), direction=coalesce(p_data->>'direction',''),
    session=coalesce(p_data->>'session',''),tags=coalesce(p_data->>'tags',''),
    version=case when p_id is null then 1 else version+1 end,updated_at=now()
    where id=result_id;
  select to_jsonb(r) into result from public.trade_records r where id=result_id;
  return result;
end $$;
revoke all on function public.save_trade(jsonb,uuid) from public,anon;
grant execute on function public.save_trade(jsonb,uuid) to authenticated;
