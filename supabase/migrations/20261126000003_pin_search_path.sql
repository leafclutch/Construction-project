-- Supabase security advisor: function_search_path_mutable.
-- Every other function already pins search_path; this trigger function was missed.
-- now() lives in pg_catalog, which is always searched, so the body is unaffected.
alter function private.touch_updated_at() set search_path = '';
