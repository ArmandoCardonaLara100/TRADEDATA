-- Additive schema: legacy app_user/trade tables are not modified or removed.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (length(name) <= 80),
  created_at timestamptz not null default now()
);
create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  currency text not null default 'USD' check (currency in ('USD','EUR','GBP','MXN')),
  "initialBalance" numeric(24,8) not null check ("initialBalance" > 0 and "initialBalance" <= 1e12),
  "breakEvenBand" numeric(24,8) not null default 15 check ("breakEvenBand" >= 0 and "breakEvenBand" <= 1e9),
  "sourceSheet" text,
  "sourceHash" text,
  "baselineBreakEven" boolean not null default false,
  "riskMetric" text not null default 'planned' check ("riskMetric" in ('planned','average-win')),
  last_sequence integer not null default 0 check (last_sequence >= 0),
  "createdAt" timestamptz not null default now(),
  unique(id, user_id),
  unique(user_id, "sourceHash", "sourceSheet")
);
create index trading_accounts_owner on public.trading_accounts(user_id);
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  "accountId" uuid not null,
  sequence integer not null check (sequence > 0),
  date date,
  symbol text not null default '' check (length(symbol) <= 30),
  "riskPercent" numeric(12,8) check ("riskPercent" between 0 and 1),
  "rewardRisk" numeric(16,8) check ("rewardRisk" between 0 and 1000),
  duration numeric(16,4) check (duration between 0 and 1e7),
  pnl numeric(24,8) check (pnl between -1e12 and 1e12),
  notes text not null default '' check (length(notes) <= 10000),
  feelings text not null default '' check (length(feelings) <= 5000),
  "evidenceUrl" text not null default '' check ("evidenceUrl" = '' or "evidenceUrl" ~ '^https://'),
  strategy text not null default '' check (length(strategy) <= 80),
  direction text not null default '' check (direction in ('','long','short')),
  session text not null default '' check (length(session) <= 40),
  tags text not null default '' check (length(tags) <= 250),
  "sourceRow" integer,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key ("accountId", user_id) references public.trading_accounts(id,user_id) on delete cascade,
  unique("accountId", sequence)
);
create index trades_owner_sequence on public.trades(user_id,"accountId",sequence);
create index trades_owner_date on public.trades(user_id,"accountId",date);
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  unique(user_id,name)
);
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  kind text not null check (kind in ('simulation','bankroll')),
  input jsonb not null check (jsonb_typeof(input) = 'object' and octet_length(input::text) <= 10000),
  "createdAt" timestamptz not null default now()
);
create index scenarios_owner on public.scenarios(user_id);
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','dark','light')),
  "selectedAccountId" uuid,
  updated_at timestamptz not null default now(),
  foreign key ("selectedAccountId",user_id) references public.trading_accounts(id,user_id) on delete set null ("selectedAccountId")
);
create index preferences_account on public.preferences("selectedAccountId",user_id);

alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
do $$
declare t text;
begin
  foreach t in array array['trading_accounts','trades','strategies','scenarios','preferences'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy own_records on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
  end loop;
end $$;
revoke all on public.profiles, public.trading_accounts, public.trades, public.strategies, public.scenarios, public.preferences from anon;
grant select,insert,update,delete on public.profiles, public.trading_accounts, public.trades, public.strategies, public.scenarios, public.preferences to authenticated;

-- Return decimal inputs as strings: PostgREST JSON numbers would lose precision
-- before Decimal.js can consume them. These views retain caller RLS.
create view public.account_records with (security_invoker=true) as
select id,user_id,name,currency,"initialBalance"::text,"breakEvenBand"::text,
  "sourceSheet","sourceHash","baselineBreakEven","riskMetric",last_sequence,"createdAt"
from public.trading_accounts;
create view public.trade_records with (security_invoker=true) as
select id,user_id,"accountId",sequence,date,symbol,"riskPercent"::text,"rewardRisk"::text,
  duration,pnl::text,notes,feelings,"evidenceUrl",strategy,direction,session,tags,"sourceRow",version
from public.trades;
grant select on public.account_records,public.trade_records to authenticated;
revoke all on public.account_records,public.trade_records from anon;

-- Invoker functions run as the user's JWT role and cannot bypass RLS.
create function public.save_trade(p_data jsonb, p_id uuid default null)
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
    if not found then raise sqlstate '40001' using message='Operation changed or removed'; end if;
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

create function public.import_workbook(p_sheets jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare sheet jsonb; row_data jsonb; account_id uuid; existing boolean; output jsonb := '[]';
begin
  if auth.uid() is null then raise sqlstate '42501' using message='Authentication required'; end if;
  if jsonb_typeof(p_sheets) <> 'array' or jsonb_array_length(p_sheets) > 10 then
    raise sqlstate '22023' using message='Invalid workbook';
  end if;
  -- Serialize repeated imports by owner; a transaction rolls back all sheets on error.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  for sheet in select value from jsonb_array_elements(p_sheets) loop
    select id into account_id from public.trading_accounts
      where user_id=auth.uid() and "sourceHash"=sheet->>'sourceHash' and "sourceSheet"=sheet->>'sourceSheet';
    existing := found;
    if not existing then
      if jsonb_array_length(sheet->'rows') > 5000 then raise sqlstate '22023' using message='Too many operations'; end if;
      insert into public.trading_accounts(user_id,name,currency,"initialBalance","breakEvenBand","sourceSheet","sourceHash","baselineBreakEven","riskMetric")
      values(auth.uid(),sheet->>'name','USD',(sheet->>'initialBalance')::numeric,(sheet->>'breakEvenBand')::numeric,
        sheet->>'sourceSheet',sheet->>'sourceHash',(sheet->>'baselineBreakEven')::boolean,sheet->>'riskMetric')
      returning id into account_id;
      for row_data in select value from jsonb_array_elements(sheet->'rows') loop
        insert into public.trades(user_id,"accountId",sequence,date,symbol,"riskPercent","rewardRisk",duration,pnl,notes,feelings,"evidenceUrl",strategy,direction,session,tags,"sourceRow")
        values(auth.uid(),account_id,(row_data->>'sequence')::integer,nullif(row_data->>'date','')::date,
          coalesce(row_data->>'symbol',''),(row_data->>'riskPercent')::numeric,(row_data->>'rewardRisk')::numeric,
          (row_data->>'duration')::numeric,(row_data->>'pnl')::numeric,coalesce(row_data->>'notes',''),coalesce(row_data->>'feelings',''),
          coalesce(row_data->>'evidenceUrl',''),coalesce(row_data->>'strategy',''),coalesce(row_data->>'direction',''),
          coalesce(row_data->>'session',''),coalesce(row_data->>'tags',''),(row_data->>'sourceRow')::integer);
      end loop;
      update public.trading_accounts set last_sequence=coalesce((select max(sequence) from public.trades where "accountId"=account_id),0) where id=account_id;
    end if;
    output := output || jsonb_build_array(jsonb_build_object('id',account_id,'name',sheet->>'name','count',jsonb_array_length(sheet->'rows'),'existing',existing));
  end loop;
  return output;
end $$;
revoke all on function public.import_workbook(jsonb) from public,anon;
grant execute on function public.import_workbook(jsonb) to authenticated;
