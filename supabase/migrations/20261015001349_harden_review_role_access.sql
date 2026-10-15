-- Read-only role visibility is enough for the signed-in application to render
-- moderator controls. No client may assign or change a role.
create policy users_can_read_their_own_review_role
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()));

grant select on public.user_roles to authenticated;

drop policy review_admins_can_manage_reviews on public.review_submissions;
drop policy approved_reviews_are_public on public.review_submissions;
drop policy users_can_read_their_own_reviews on public.review_submissions;
drop policy users_can_submit_reviews on public.review_submissions;

drop function public.is_review_admin();

create policy anonymous_users_can_read_approved_reviews
on public.review_submissions for select
to anon
using (status = 'approved');

create policy authenticated_users_can_read_permitted_reviews
on public.review_submissions for select
to authenticated
using (
  status = 'approved'
  or user_id = (select auth.uid())
  or exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'review_admin'
  )
);

create policy users_can_submit_pending_reviews
on public.review_submissions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and approved_at is null
  and approved_by is null
);

create policy review_admins_can_update_other_reviews
on public.review_submissions for update
to authenticated
using (
  user_id is distinct from (select auth.uid())
  and exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'review_admin'
  )
)
with check (
  user_id is distinct from (select auth.uid())
  and exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'review_admin'
  )
);

create policy review_admins_can_delete_other_reviews
on public.review_submissions for delete
to authenticated
using (
  user_id is distinct from (select auth.uid())
  and exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'review_admin'
  )
);

create index review_submissions_approved_by_index
on public.review_submissions (approved_by);
