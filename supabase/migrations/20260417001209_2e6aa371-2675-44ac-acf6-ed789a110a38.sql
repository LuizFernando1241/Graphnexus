-- Add column to track when user manually changed status
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS manual_status_override timestamp with time zone;

-- Update auto_triage to respect recent manual overrides
CREATE OR REPLACE FUNCTION public.auto_triage_tasks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE tasks
  SET status = 'todo'
  WHERE status = 'backlog'
    AND due_date IS NOT NULL
    AND due_date <= (CURRENT_DATE + INTERVAL '2 days')
    AND (
      manual_status_override IS NULL
      OR manual_status_override < (now() - INTERVAL '24 hours')
    );
$function$;