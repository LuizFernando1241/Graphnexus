CREATE OR REPLACE FUNCTION public.auto_triage_tasks()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  UPDATE tasks
  SET status = 'todo'
  WHERE status = 'backlog'
    AND due_date IS NOT NULL
    AND due_date <= (CURRENT_DATE + INTERVAL '2 days')
    AND user_id = auth.uid()
    AND (
      manual_status_override IS NULL
      OR manual_status_override < (now() - INTERVAL '24 hours')
    );
$function$;