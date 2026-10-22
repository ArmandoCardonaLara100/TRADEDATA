-- The application uploads through a Vercel Function, whose request cap is 4.5 MB.
update storage.buckets set file_size_limit=4194304 where id='trade-evidence';
