DROP VIEW IF EXISTS public.project_progress_recursive;

CREATE VIEW public.project_progress_recursive
WITH (security_invoker = on) AS
WITH RECURSIVE project_tree AS (
  SELECT p.id, p.parent_id, p.id AS root_id
  FROM public.projects p
  UNION ALL
  SELECT p.id, p.parent_id, pt.root_id
  FROM public.projects p
  INNER JOIN project_tree pt ON p.parent_id = pt.id
),
task_counts AS (
  SELECT
    el.source_id AS project_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE t.status = 'done') AS done_tasks
  FROM public.entity_links el
  INNER JOIN public.tasks t ON t.id = el.target_id
  WHERE el.source_type = 'project'
    AND el.target_type = 'task'
  GROUP BY el.source_id
)
SELECT
  pt.root_id AS project_id,
  COALESCE(SUM(tc.total_tasks), 0) AS total_tasks_recursive,
  COALESCE(SUM(tc.done_tasks), 0) AS done_tasks_recursive,
  CASE
    WHEN COALESCE(SUM(tc.total_tasks), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(tc.done_tasks), 0)::numeric / COALESCE(SUM(tc.total_tasks), 0)::numeric) * 100,
      1
    )
  END AS progress_percent
FROM project_tree pt
LEFT JOIN task_counts tc ON tc.project_id = pt.id
GROUP BY pt.root_id;

GRANT SELECT ON public.project_progress_recursive TO authenticated;
GRANT SELECT ON public.project_progress_recursive TO service_role;