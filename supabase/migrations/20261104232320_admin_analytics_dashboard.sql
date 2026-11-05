-- Full-administrator analytics and review audit trail.
-- Raw analytics remain inaccessible through the Data API; signed-in clients
-- can only append validated events through record_analytics_event().

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check check (role in ('review_admin', 'admin'));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_full_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = p_user_id and role = 'admin'
  );
$$;

revoke all on function private.is_full_admin(uuid) from public, anon, authenticated;

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint analytics_events_pair_check check (
    (feature = 'overview' and event_name in ('overview_viewed', 'pdf_exported'))
    or (feature = 'trading_journal' and event_name in ('journal_viewed', 'trade_created', 'trade_updated', 'trade_deleted'))
    or (feature = 'statistics' and event_name in ('statistics_viewed', 'statistics_filter_changed', 'statistics_pdf_exported'))
    or (feature = 'calendar' and event_name in ('calendar_viewed', 'calendar_day_opened'))
    or (feature = 'monte_carlo' and event_name in ('monte_carlo_viewed', 'simulation_run'))
    or (feature = 'funded_accounts' and event_name = 'funded_accounts_viewed')
    or (feature = 'news' and event_name in ('news_viewed', 'news_filter_changed'))
    or (feature = 'review' and event_name in ('review_viewed', 'review_submitted'))
    or (feature = 'trade_sharing' and event_name in ('trade_share_created', 'trade_share_revoked'))
  )
);

create index analytics_events_created_at_index on public.analytics_events (created_at desc);
create index analytics_events_user_activity_index on public.analytics_events (user_id, created_at desc);
create index analytics_events_feature_activity_index on public.analytics_events (feature, event_name, created_at desc);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;

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
  v_key text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 4096 then
    raise exception 'Invalid analytics metadata' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(coalesce(p_metadata, '{}'::jsonb)) loop
    if v_key not in ('account_type', 'export_type', 'filter_name', 'range', 'status', 'action', 'simulation_size') then
      raise exception 'Unsupported analytics metadata key' using errcode = '22023';
    end if;
  end loop;
  insert into public.analytics_events (user_id, feature, event_name, metadata)
  values (v_user_id, p_feature, p_event_name, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.record_analytics_event(text, text, jsonb) from public, anon;
grant execute on function public.record_analytics_event(text, text, jsonb) to authenticated;

create table public.review_moderation_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  review_id uuid not null,
  action text not null check (action in ('approved', 'rejected', 'deleted')),
  created_at timestamptz not null default now()
);

create index review_moderation_audit_created_at_index on public.review_moderation_audit (created_at desc);
create index review_moderation_audit_actor_index on public.review_moderation_audit (actor_user_id, created_at desc);
alter table public.review_moderation_audit enable row level security;
revoke all on public.review_moderation_audit from public, anon, authenticated;

create or replace function public.audit_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_action text;
begin
  if v_actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    v_action := 'deleted';
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    v_action := new.status;
  else
    return new;
  end if;
  insert into public.review_moderation_audit (actor_user_id, review_id, action)
  values (v_actor, coalesce(new.id, old.id), v_action);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.audit_review_moderation() from public, anon, authenticated;

create trigger review_moderation_audit_after_update
after update of status on public.review_submissions
for each row execute function public.audit_review_moderation();

create trigger review_moderation_audit_after_delete
after delete on public.review_submissions
for each row execute function public.audit_review_moderation();

drop policy if exists authenticated_users_can_read_permitted_reviews on public.review_submissions;
create policy authenticated_users_can_read_permitted_reviews
on public.review_submissions for select
to authenticated
using (
  status = 'approved'
  or user_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('review_admin', 'admin')
  )
);

drop policy if exists review_admins_can_update_other_reviews on public.review_submissions;
create policy review_admins_can_update_other_reviews
on public.review_submissions for update
to authenticated
using (
  user_id is distinct from (select auth.uid())
  and exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('review_admin', 'admin')
  )
)
with check (
  user_id is distinct from (select auth.uid())
  and exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('review_admin', 'admin')
  )
);

drop policy if exists review_admins_can_delete_other_reviews on public.review_submissions;
create policy review_admins_can_delete_other_reviews
on public.review_submissions for delete
to authenticated
using (
  user_id is distinct from (select auth.uid())
  and exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('review_admin', 'admin')
  )
);

create or replace function public.get_admin_dashboard(
  p_range text default '30d',
  p_user_page integer default 1,
  p_review_status text default 'all',
  p_review_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_start timestamptz;
  v_previous_start timestamptz;
  v_page_size integer := 20;
  v_user_page integer := greatest(1, least(coalesce(p_user_page, 1), 100000));
  v_review_page integer := greatest(1, least(coalesce(p_review_page, 1), 100000));
  v_result jsonb;
begin
  if v_actor is null or not private.is_full_admin(v_actor) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_range not in ('7d', '30d', '90d', 'all') then
    raise exception 'Invalid analytics range' using errcode = '22023';
  end if;
  if p_review_status not in ('all', 'pending', 'approved', 'rejected') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  v_start := case p_range
    when '7d' then v_now - interval '7 days'
    when '30d' then v_now - interval '30 days'
    when '90d' then v_now - interval '90 days'
    else null
  end;
  if v_start is not null then
    v_previous_start := v_start - (v_now - v_start);
  end if;

  with
  feature_catalog(feature, position) as (
    values ('overview',1),('trading_journal',2),('statistics',3),('calendar',4),
      ('monte_carlo',5),('funded_accounts',6),('news',7),('review',8),('trade_sharing',9)
  ),
  current_events as (
    select * from public.analytics_events where v_start is null or created_at >= v_start
  ),
  previous_events as (
    select * from public.analytics_events
    where v_previous_start is not null and created_at >= v_previous_start and created_at < v_start
  ),
  active_count as (select count(distinct user_id)::integer value from current_events),
  feature_current as (
    select feature,
      count(*)::integer total_events,
      count(*) filter (where event_name like '%_viewed')::integer page_views,
      count(*) filter (where event_name not like '%_viewed')::integer actual_uses,
      count(distinct user_id)::integer distinct_users
    from current_events group by feature
  ),
  feature_previous as (
    select feature,
      count(*)::integer total_events,
      count(*) filter (where event_name not like '%_viewed')::integer actual_uses
    from previous_events group by feature
  ),
  feature_rows as (
    select c.feature, c.position,
      coalesce(x.total_events,0) total_events,
      coalesce(x.page_views,0) page_views,
      coalesce(x.actual_uses,0) actual_uses,
      coalesce(x.distinct_users,0) distinct_users,
      case when a.value = 0 then 0 else round(coalesce(x.distinct_users,0)::numeric * 100 / a.value, 1) end adoption_percent,
      case when v_start is null then null
           when coalesce(y.total_events,0) = 0 then null
           else round((coalesce(x.total_events,0) - y.total_events)::numeric * 100 / y.total_events, 1)
      end trend_percent
    from feature_catalog c cross join active_count a
    left join feature_current x on x.feature=c.feature
    left join feature_previous y on y.feature=c.feature
  ),
  series_start as (
    select coalesce(v_start, (select min(created_at) from auth.users), v_now) value
  ),
  daily_series as (
    select generated_at::date as bucket_date
    from series_start, lateral generate_series(date_trunc('day', value), date_trunc('day', v_now), interval '1 day') as generated_at
  ),
  daily_users as (
    select created_at::date as bucket_date, count(*)::integer value from auth.users
    where v_start is null or created_at >= v_start group by created_at::date
  ),
  daily_active as (
    select created_at::date as bucket_date, count(distinct user_id)::integer value from current_events group by created_at::date
  ),
  account_counts as (
    select user_id,count(*)::integer value from public.trading_accounts group by user_id
  ),
  trade_counts as (
    select user_id,count(*)::integer value from public.trades group by user_id
  ),
  last_activity as (
    select user_id,max(created_at) value from public.analytics_events group by user_id
  ),
  user_rows as (
    select u.id,
      coalesce(nullif(p.name,''), 'Trader') name,
      u.created_at,
      coalesce(r.role, 'user') role,
      e.value last_activity,
      coalesce(a.value,0) account_count,
      coalesce(t.value,0) trade_count,
      case when u.banned_until is not null and u.banned_until > v_now then 'blocked'
           when e.value >= v_now - interval '30 days' then 'active'
           else 'inactive' end status
    from auth.users u
    left join public.profiles p on p.id=u.id
    left join public.user_roles r on r.user_id=u.id
    left join last_activity e on e.user_id=u.id
    left join account_counts a on a.user_id=u.id
    left join trade_counts t on t.user_id=u.id
    order by u.created_at desc,u.id
    limit v_page_size offset ((v_user_page-1)*v_page_size)
  ),
  review_rows as (
    select r.id,r.reviewer_name,r.review_text,r.status,r.submitted_at,r.approved_at,
      (r.user_id=v_actor) is_own
    from public.review_submissions r
    where p_review_status='all' or r.status=p_review_status
    order by case when r.status='pending' then 0 else 1 end,r.submitted_at desc,r.id
    limit v_page_size offset ((v_review_page-1)*v_page_size)
  )
  select jsonb_build_object(
    'range',p_range,
    'generatedAt',v_now,
    'kpis',jsonb_build_object(
      'totalUsers',(select count(*) from auth.users),
      'activeUsers',(select value from active_count),
      'newUsers',(select count(*) from auth.users where v_start is null or created_at>=v_start),
      'tradingAccounts',(select count(*) from public.trading_accounts),
      'trades',(select count(*) from public.trades),
      'tradesToday',(select count(*) from public.trades where created_at>=date_trunc('day',v_now)),
      'tradesThisMonth',(select count(*) from public.trades where created_at>=date_trunc('month',v_now)),
      'pendingReviews',(select count(*) from public.review_submissions where status='pending')
    ),
    'userGrowth',coalesce((select jsonb_agg(jsonb_build_object('date',d.bucket_date,'newUsers',coalesce(u.value,0),'activeUsers',coalesce(a.value,0)) order by d.bucket_date) from daily_series d left join daily_users u using(bucket_date) left join daily_active a using(bucket_date)),'[]'::jsonb),
    'features',coalesce((select jsonb_agg(to_jsonb(f)-'position' order by greatest(f.actual_uses,f.page_views) desc,f.position) from feature_rows f),'[]'::jsonb),
    'users',jsonb_build_object(
      'page',v_user_page,'pageSize',v_page_size,'total',(select count(*) from auth.users),
      'items',coalesce((select jsonb_agg(jsonb_build_object('name',u.name,'createdAt',u.created_at,'role',u.role,'lastActivity',u.last_activity,'accountCount',u.account_count,'tradeCount',u.trade_count,'status',u.status) order by u.created_at desc) from user_rows u),'[]'::jsonb)
    ),
    'reviews',jsonb_build_object(
      'page',v_review_page,'pageSize',v_page_size,'status',p_review_status,
      'total',(select count(*) from public.review_submissions where p_review_status='all' or status=p_review_status),
      'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'reviewerName',r.reviewer_name,'reviewText',r.review_text,'status',r.status,'submittedAt',r.submitted_at,'approvedAt',r.approved_at,'isOwn',r.is_own) order by case when r.status='pending' then 0 else 1 end,r.submitted_at desc) from review_rows r),'[]'::jsonb)
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_admin_dashboard(text, integer, text, integer) from public, anon;
grant execute on function public.get_admin_dashboard(text, integer, text, integer) to authenticated;
