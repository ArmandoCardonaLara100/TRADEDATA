-- Preserve the original evidencePath as image slot 1. The positional array
-- adds image slots 2-4 without rewriting or invalidating historical evidence.
alter table public.trades
  add column "additionalEvidencePaths" text[] not null default array[]::text[]
  constraint trades_additional_evidence_paths_check
  check (
    cardinality("additionalEvidencePaths") <= 3
    and length(array_to_string("additionalEvidencePaths", '')) <= 900
  );

-- Append the new column so existing view consumers retain their column order.
create or replace view public.trade_records with (security_invoker=true) as
select id,user_id,"accountId",sequence,date,symbol,"riskPercent"::text,"rewardRisk"::text,
  duration,pnl::text,notes,feelings,"evidenceUrl",strategy,direction,session,tags,"sourceRow",version,
  "setupGrade",mindset,"evidencePath","additionalEvidenceUrls","additionalEvidencePaths"
from public.trades;

-- Update one slot while holding the trade row lock. This prevents concurrent
-- uploads to different slots from overwriting each other's positional array.
create or replace function public.set_trade_evidence_path(p_trade_id uuid,p_slot integer,p_path text)
returns text language plpgsql security invoker set search_path = '' as $$
declare previous_path text;
begin
  if auth.uid() is null then raise sqlstate '42501' using message='Authentication required'; end if;
  if p_slot < 1 or p_slot > 4 then raise sqlstate '22023' using message='Evidence slot must be between 1 and 4'; end if;
  if p_path <> '' and strpos(p_path,(select auth.uid())::text||'/'||p_trade_id::text||'/'||p_slot::text||'-') <> 1 then
    raise sqlstate '22023' using message='Invalid evidence path';
  end if;

  select case when p_slot=1 then "evidencePath" else coalesce("additionalEvidencePaths"[p_slot-1],'') end
    into previous_path
    from public.trades
    where id=p_trade_id and user_id=(select auth.uid())
    for update;
  if not found then raise sqlstate 'P0002' using message='Operation not found'; end if;

  update public.trades set
    "evidencePath"=case when p_slot=1 then p_path else "evidencePath" end,
    "additionalEvidencePaths"=case when p_slot=1 then "additionalEvidencePaths" else array[
      case when p_slot=2 then p_path else coalesce("additionalEvidencePaths"[1],'') end,
      case when p_slot=3 then p_path else coalesce("additionalEvidencePaths"[2],'') end,
      case when p_slot=4 then p_path else coalesce("additionalEvidencePaths"[3],'') end
    ] end,
    updated_at=now()
    where id=p_trade_id and user_id=(select auth.uid());
  return coalesce(previous_path,'');
end $$;
revoke all on function public.set_trade_evidence_path(uuid,integer,text) from public,anon;
grant execute on function public.set_trade_evidence_path(uuid,integer,text) to authenticated;
