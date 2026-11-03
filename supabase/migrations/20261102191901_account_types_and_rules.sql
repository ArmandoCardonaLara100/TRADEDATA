alter table public.trading_accounts
  add column "accountType" text
    check ("accountType" is null or "accountType" in ('challenge','funded','own_capital','demo')),
  add column "currentPhase" integer
    check ("currentPhase" is null or "currentPhase" between 1 and 20);

create table public.account_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_kind text not null check (rule_kind in ('challenge_phase','funded')),
  phase_number integer check (phase_number is null or phase_number between 1 and 20),
  "profitTarget" numeric(12,8) not null check ("profitTarget" > 0 and "profitTarget" <= 100),
  "maxLossLimit" numeric(12,8) not null check ("maxLossLimit" > 0 and "maxLossLimit" <= 100),
  "dailyLossLimit" numeric(12,8) not null check ("dailyLossLimit" > 0 and "dailyLossLimit" <= 100),
  "drawdownType" text not null check ("drawdownType" in ('static','trailing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id,user_id) references public.trading_accounts(id,user_id) on delete cascade,
  check ("dailyLossLimit" <= "maxLossLimit"),
  check (
    (rule_kind='challenge_phase' and phase_number is not null)
    or (rule_kind='funded' and phase_number is null)
  )
);

create unique index account_rules_challenge_phase
  on public.account_rules(account_id,phase_number)
  where rule_kind='challenge_phase';
create unique index account_rules_funded
  on public.account_rules(account_id)
  where rule_kind='funded';
create index account_rules_owner on public.account_rules(user_id,account_id);

alter table public.account_rules enable row level security;
create policy own_account_rules on public.account_rules for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.account_rules from anon;
grant select,insert,update,delete on public.account_rules to authenticated;

create or replace view public.account_records with (security_invoker=true) as
select id,user_id,name,currency,"initialBalance"::text,"breakEvenBand"::text,
  "sourceSheet","sourceHash","baselineBreakEven","riskMetric",last_sequence,"createdAt",
  "accountType","currentPhase"
from public.trading_accounts;

create view public.account_rule_records with (security_invoker=true) as
select id,account_id,user_id,rule_kind,phase_number,
  "profitTarget"::text,"maxLossLimit"::text,"dailyLossLimit"::text,
  "drawdownType",created_at,updated_at
from public.account_rules;
revoke all on public.account_rule_records from anon;
grant select on public.account_rule_records to authenticated;

create function public.save_trading_account(p_data jsonb,p_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  v_account_id uuid;
  account_type text := p_data->>'accountType';
  phase_count integer;
  current_phase integer := nullif(p_data->>'currentPhase','')::integer;
  rule jsonb;
  rule_index integer := 0;
begin
  if auth.uid() is null then raise sqlstate '42501' using message='Authentication required'; end if;
  if account_type not in ('challenge','funded','own_capital','demo') then
    raise sqlstate '22023' using message='Invalid account type';
  end if;
  if jsonb_typeof(coalesce(p_data->'rules','[]'::jsonb)) <> 'array' then
    raise sqlstate '22023' using message='Invalid account rules';
  end if;
  phase_count := jsonb_array_length(coalesce(p_data->'rules','[]'::jsonb));
  if account_type='challenge' and (phase_count < 1 or phase_count > 20 or current_phase is null or current_phase < 1 or current_phase > phase_count) then
    raise sqlstate '22023' using message='Invalid challenge phases';
  end if;
  if account_type='funded' and phase_count <> 1 then
    raise sqlstate '22023' using message='Invalid funded rules';
  end if;
  if account_type<>'challenge' and current_phase is not null then
    raise sqlstate '22023' using message='Current phase applies only to challenge accounts';
  end if;
  if account_type in ('own_capital','demo') and phase_count <> 0 then
    raise sqlstate '22023' using message='Rules do not apply to this account type';
  end if;

  if p_id is null then
    insert into public.trading_accounts(
      user_id,name,currency,"initialBalance","breakEvenBand","accountType","currentPhase"
    ) values (
      auth.uid(),p_data->>'name',p_data->>'currency',(p_data->>'initialBalance')::numeric,
      (p_data->>'breakEvenBand')::numeric,account_type,
      case when account_type='challenge' then current_phase else null end
    ) returning id into v_account_id;
  else
    update public.trading_accounts set
      name=p_data->>'name',currency=p_data->>'currency',
      "initialBalance"=(p_data->>'initialBalance')::numeric,
      "breakEvenBand"=(p_data->>'breakEvenBand')::numeric,
      "accountType"=account_type,
      "currentPhase"=case when account_type='challenge' then current_phase else null end
    where id=p_id and user_id=auth.uid()
    returning id into v_account_id;
    if v_account_id is null then raise sqlstate 'P0002' using message='Account not found'; end if;
  end if;

  delete from public.account_rules r where r.account_id=v_account_id and r.user_id=auth.uid();
  for rule in select value from jsonb_array_elements(coalesce(p_data->'rules','[]'::jsonb)) loop
    rule_index := rule_index + 1;
    if account_type='challenge' and (rule->>'phaseNumber')::integer <> rule_index then
      raise sqlstate '22023' using message='Challenge phases must be sequential';
    end if;
    insert into public.account_rules(
      account_id,user_id,rule_kind,phase_number,"profitTarget","maxLossLimit","dailyLossLimit","drawdownType"
    ) values (
      v_account_id,auth.uid(),
      case when account_type='challenge' then 'challenge_phase' else 'funded' end,
      case when account_type='challenge' then (rule->>'phaseNumber')::integer else null end,
      (rule->>'profitTarget')::numeric,(rule->>'maxLossLimit')::numeric,
      (rule->>'dailyLossLimit')::numeric,rule->>'drawdownType'
    );
  end loop;
  return v_account_id;
end $$;

revoke all on function public.save_trading_account(jsonb,uuid) from public,anon;
grant execute on function public.save_trading_account(jsonb,uuid) to authenticated;
