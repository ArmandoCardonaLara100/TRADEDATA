-- Public sharing is a separate capability layer. Journal rows and the private
-- evidence bucket remain inaccessible to anonymous roles.
alter table public.trades
  add constraint trades_id_user_id_unique unique (id,user_id);

create table public.trade_shares (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null,
  user_id uuid not null,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_shares_trade_unique unique (trade_id),
  constraint trade_shares_trade_owner_fkey
    foreign key (trade_id,user_id)
    references public.trades(id,user_id)
    on delete cascade
);

create index trade_shares_owner on public.trade_shares(user_id);

alter table public.trade_shares enable row level security;

create policy trade_shares_owner_select on public.trade_shares
  for select to authenticated
  using ((select auth.uid())=user_id);

create policy trade_shares_owner_insert on public.trade_shares
  for insert to authenticated
  with check (
    (select auth.uid())=user_id
    and exists (
      select 1 from public.trades t
      where t.id=trade_id and t.user_id=(select auth.uid())
    )
  );

create policy trade_shares_owner_update on public.trade_shares
  for update to authenticated
  using ((select auth.uid())=user_id)
  with check (
    (select auth.uid())=user_id
    and exists (
      select 1 from public.trades t
      where t.id=trade_id and t.user_id=(select auth.uid())
    )
  );

create policy trade_shares_owner_delete on public.trade_shares
  for delete to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.trade_shares from public,anon;
grant select,insert,update,delete on public.trade_shares to authenticated;
