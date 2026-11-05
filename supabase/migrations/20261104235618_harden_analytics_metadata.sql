-- Analytics metadata is intentionally small and enum-like. This prevents an
-- authenticated caller from placing notes, URLs, or other private content in
-- a field that is meant only for product-level aggregation.
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
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_key text;
  v_simulation_size numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_metadata) <> 'object' or pg_column_size(v_metadata) > 512 then
    raise exception 'Invalid analytics metadata' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(v_metadata) loop
    if v_key not in ('export_type', 'filter_name', 'simulation_size') then
      raise exception 'Unsupported analytics metadata key' using errcode = '22023';
    end if;
  end loop;

  if v_metadata ? 'export_type' then
    if p_feature <> 'overview' or p_event_name <> 'pdf_exported'
       or jsonb_typeof(v_metadata->'export_type') <> 'string'
       or v_metadata->>'export_type' <> 'account_pdf' then
      raise exception 'Invalid analytics export metadata' using errcode = '22023';
    end if;
  end if;
  if v_metadata ? 'filter_name' then
    if p_feature <> 'news' or p_event_name <> 'news_filter_changed'
       or jsonb_typeof(v_metadata->'filter_name') <> 'string'
       or v_metadata->>'filter_name' not in ('currency', 'country') then
      raise exception 'Invalid analytics filter metadata' using errcode = '22023';
    end if;
  end if;
  if v_metadata ? 'simulation_size' then
    if p_feature <> 'monte_carlo' or p_event_name <> 'simulation_run'
       or jsonb_typeof(v_metadata->'simulation_size') <> 'number' then
      raise exception 'Invalid analytics simulation metadata' using errcode = '22023';
    end if;
    v_simulation_size := (v_metadata->>'simulation_size')::numeric;
    if v_simulation_size < 1 or v_simulation_size > 1000 or mod(v_simulation_size, 1) <> 0 then
      raise exception 'Invalid analytics simulation metadata' using errcode = '22023';
    end if;
  end if;

  insert into public.analytics_events (user_id, feature, event_name, metadata)
  values (v_user_id, p_feature, p_event_name, v_metadata);
end;
$$;

revoke all on function public.record_analytics_event(text, text, jsonb) from public, anon;
grant execute on function public.record_analytics_event(text, text, jsonb) to authenticated;
