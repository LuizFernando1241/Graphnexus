CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  content text,
  color text,
  emoji text,
  tags text[],
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_own" ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  description text,
  status text NOT NULL DEFAULT 'backlog',
  priority text NOT NULL DEFAULT 'none',
  due_date date,
  completed_at timestamptz,
  estimated_minutes integer,
  subtasks jsonb NOT NULL DEFAULT '[]',
  archived boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  recurrence_end_date date,
  recurrence_parent_id uuid,
  recurrence_days integer[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_own" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  description text,
  status text NOT NULL DEFAULT 'active',
  cover_color text,
  emoji text,
  start_date date,
  target_date date,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_own" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id, target_type, target_id)
);
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_links_own" ON public.entity_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.auto_triage_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE tasks
  SET status = 'todo'
  WHERE status = 'backlog'
    AND due_date IS NOT NULL
    AND due_date <= (CURRENT_DATE + INTERVAL '2 days')
    AND user_id = auth.uid();
END;
$$;

INSERT INTO storage.buckets (id, name, public) VALUES ('nexus_files', 'nexus_files', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "nexus_files_select_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "nexus_files_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "nexus_files_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "nexus_files_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);