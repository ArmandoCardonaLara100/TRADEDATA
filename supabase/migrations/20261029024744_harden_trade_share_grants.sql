-- Supabase's schema defaults may pre-grant broader table privileges to the
-- authenticated role. Keep only the four operations the owner UI requires.
revoke all on public.trade_shares from authenticated;
grant select,insert,update,delete on public.trade_shares to authenticated;

create index trade_shares_trade_owner on public.trade_shares(trade_id,user_id);
