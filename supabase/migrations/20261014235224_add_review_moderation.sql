-- Review workflow: submitted reviews are private until a database-authorized
-- moderator approves them. Roles are intentionally not writable by clients.
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('review_admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;

create or replace function public.is_review_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'review_admin'
  );
$$;

revoke all on function public.is_review_admin() from public, anon;
grant execute on function public.is_review_admin() to authenticated;

create table public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null check (length(reviewer_name) between 1 and 80),
  review_text text not null check (length(review_text) between 3 and 1600),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  check (
    (status = 'approved' and approved_at is not null and approved_by is not null)
    or (status <> 'approved' and approved_at is null and approved_by is null)
  )
);

create index review_submissions_public_index
  on public.review_submissions (approved_at desc)
  where status = 'approved';
create index review_submissions_owner_index
  on public.review_submissions (user_id, submitted_at desc);
create index review_submissions_moderation_index
  on public.review_submissions (status, submitted_at asc);

create or replace function public.normalize_review_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare profile_name text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
    new.user_id := auth.uid();
    select name into profile_name from public.profiles where id = auth.uid();
    new.reviewer_name := coalesce(nullif(profile_name, ''), 'Trader');
    new.status := 'pending';
    new.submitted_at := now();
    new.approved_at := null;
    new.approved_by := null;
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    else
      new.approved_at := null;
      new.approved_by := null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_review_submission() from public, anon, authenticated;

create trigger review_submission_before_insert
before insert on public.review_submissions
for each row execute function public.normalize_review_submission();

create trigger review_submission_before_status_update
before update of status on public.review_submissions
for each row execute function public.normalize_review_submission();

alter table public.review_submissions enable row level security;

create policy approved_reviews_are_public
on public.review_submissions for select
to anon, authenticated
using (status = 'approved');

create policy users_can_read_their_own_reviews
on public.review_submissions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy users_can_submit_reviews
on public.review_submissions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and approved_at is null
  and approved_by is null
);

create policy review_admins_can_manage_reviews
on public.review_submissions for all
to authenticated
using ((select public.is_review_admin()))
with check ((select public.is_review_admin()));

revoke all on public.review_submissions from anon;
grant select on public.review_submissions to anon;
grant select, insert, update, delete on public.review_submissions to authenticated;
