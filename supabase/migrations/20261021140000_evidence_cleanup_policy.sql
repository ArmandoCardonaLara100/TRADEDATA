-- Storage removes need read visibility even after the owning trade has been
-- deleted. Keep the bucket private and scope both read and delete to the
-- authenticated user's folder; insertion still requires an owned trade.
drop policy trade_evidence_read on storage.objects;
create policy trade_evidence_read on storage.objects for select to authenticated
using (bucket_id='trade-evidence' and (storage.foldername(name))[1]=(select auth.uid()::text));
