-- Extend the aggregate-only admin response with explicit activity windows and a
-- database-aggregated feature-usage timeline. The authorization boundary is
-- unchanged: only a live full-admin role can execute this function.
create or replace function public.get_admin_dashboard(
  p_range text default '30d',
  p_user_page integer default 1,
  p_review_status text default 'pending',
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
    select feature,count(*)::integer total_events
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
  feature_daily as (
    select created_at::date bucket_date,feature,
      count(*) filter (where event_name not like '%_viewed')::integer actual_uses
    from current_events
    group by created_at::date,feature
    having count(*) filter (where event_name not like '%_viewed') > 0
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
    select u.id,coalesce(nullif(p.name,''), 'Trader') name,u.created_at,
      coalesce(r.role, 'user') role,e.value last_activity,
      coalesce(a.value,0) account_count,coalesce(t.value,0) trade_count,
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
    'analyticsEnabledAt',(select min(created_at) from public.analytics_events),
    'kpis',jsonb_build_object(
      'totalUsers',(select count(*) from auth.users),
      'activeUsers',(select value from active_count),
      'newUsers',(select count(*) from auth.users where v_start is null or created_at>=v_start),
      'dailyActiveUsers',(select count(distinct user_id) from public.analytics_events where created_at>=v_now-interval '1 day'),
      'weeklyActiveUsers',(select count(distinct user_id) from public.analytics_events where created_at>=v_now-interval '7 days'),
      'monthlyActiveUsers',(select count(distinct user_id) from public.analytics_events where created_at>=v_now-interval '30 days'),
      'tradingAccounts',(select count(*) from public.trading_accounts),
      'trades',(select count(*) from public.trades),
      'tradesToday',(select count(*) from public.trades where created_at>=date_trunc('day',v_now)),
      'tradesThisWeek',(select count(*) from public.trades where created_at>=date_trunc('week',v_now)),
      'tradesThisMonth',(select count(*) from public.trades where created_at>=date_trunc('month',v_now)),
      'pendingReviews',(select count(*) from public.review_submissions where status='pending')
    ),
    'userGrowth',coalesce((select jsonb_agg(jsonb_build_object('date',d.bucket_date,'newUsers',coalesce(u.value,0),'activeUsers',coalesce(a.value,0)) order by d.bucket_date) from daily_series d left join daily_users u using(bucket_date) left join daily_active a using(bucket_date)),'[]'::jsonb),
    'featureTimeline',coalesce((select jsonb_agg(jsonb_build_object('date',f.bucket_date,'feature',f.feature,'actualUses',f.actual_uses) order by f.bucket_date,f.feature) from feature_daily f),'[]'::jsonb),
    'features',coalesce((select jsonb_agg(to_jsonb(f)-'position' order by f.actual_uses desc,f.distinct_users desc,f.page_views desc,f.position) from feature_rows f),'[]'::jsonb),
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
