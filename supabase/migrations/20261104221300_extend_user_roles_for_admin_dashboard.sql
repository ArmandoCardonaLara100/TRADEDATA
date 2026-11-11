alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('review_admin', 'admin'));

comment on table public.user_roles is
  'Privileged application role assignments. Users without a row are standard users.';

comment on column public.user_roles.role is
  'Privileged role: review_admin for review moderation only; admin for full admin dashboard access.';

drop policy if exists "authenticated_users_can_read_permitted_reviews"
  on public.review_submissions;

create policy "authenticated_users_can_read_permitted_reviews"
  on public.review_submissions
  for select
  to authenticated
  using (
    status = 'approved'
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.user_roles
      where user_roles.user_id = (select auth.uid())
        and user_roles.role in ('review_admin', 'admin')
    )
  );

drop policy if exists "review_admins_can_update_other_reviews"
  on public.review_submissions;

create policy "review_admins_can_update_other_reviews"
  on public.review_submissions
  for update
  to authenticated
  using (
    user_id is distinct from (select auth.uid())
    and exists (
      select 1
      from public.user_roles
      where user_roles.user_id = (select auth.uid())
        and user_roles.role in ('review_admin', 'admin')
    )
  )
  with check (
    user_id is distinct from (select auth.uid())
    and exists (
      select 1
      from public.user_roles
      where user_roles.user_id = (select auth.uid())
        and user_roles.role in ('review_admin', 'admin')
    )
  );

drop policy if exists "review_admins_can_delete_other_reviews"
  on public.review_submissions;

create policy "review_admins_can_delete_other_reviews"
  on public.review_submissions
  for delete
  to authenticated
  using (
    user_id is distinct from (select auth.uid())
    and exists (
      select 1
      from public.user_roles
      where user_roles.user_id = (select auth.uid())
        and user_roles.role in ('review_admin', 'admin')
    )
  );
