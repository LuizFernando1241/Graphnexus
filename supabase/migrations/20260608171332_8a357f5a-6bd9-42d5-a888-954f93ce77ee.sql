REVOKE EXECUTE ON FUNCTION public.auto_triage_tasks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_triage_tasks() TO service_role;