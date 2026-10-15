-- A moderator may review other traders' submissions, never their own.
drop policy review_admins_can_manage_reviews on public.review_submissions;

create policy review_admins_can_manage_reviews
on public.review_submissions for all
to authenticated
using (
  (select public.is_review_admin())
  and user_id is distinct from (select auth.uid())
)
with check (
  (select public.is_review_admin())
  and user_id is distinct from (select auth.uid())
);
