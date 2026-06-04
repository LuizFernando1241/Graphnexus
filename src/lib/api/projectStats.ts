import { supabase } from "@/integrations/supabase/client";
import { fetchEntityLinks } from "@/lib/api/links";
import type { Task, Note } from "@/types/entities";

export async function fetchLinkedTasksForProject(projectId: string): Promise<Task[]> {
  const links = await fetchEntityLinks(projectId, "project");
  const taskIds = new Set<string>();
  for (const l of links) {
    if (l.source_type === "task") taskIds.add(l.source_id);
    if (l.target_type === "task") taskIds.add(l.target_id);
  }
  if (taskIds.size === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .in("id", Array.from(taskIds));
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, subtasks: Array.isArray(r.subtasks) ? r.subtasks : [] })) as Task[];
}

export async function fetchLinkedNotesForProject(projectId: string): Promise<Note[]> {
  const links = await fetchEntityLinks(projectId, "project");
  const noteIds = new Set<string>();
  for (const l of links) {
    if (l.source_type === "note") noteIds.add(l.source_id);
    if (l.target_type === "note") noteIds.add(l.target_id);
  }
  if (noteIds.size === 0) return [];
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .in("id", Array.from(noteIds));
  if (error) throw error;
  return (data || []) as Note[];
}

export interface ProgressStats {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  backlog: number;
  percent: number;
}

export function computeProgress(tasks: Task[]): ProgressStats {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const backlog = tasks.filter((t) => t.status === "backlog").length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, inProgress, todo, backlog, percent };
}

export interface BurndownPoint { date: string; remaining: number; ideal: number }

export function buildBurndownSeries(tasks: Task[], startDate?: string | null, targetDate?: string | null): BurndownPoint[] {
  if (!tasks.length) return [];
  const dates = tasks.map((t) => t.created_at).filter(Boolean) as string[];
  const start = startDate ? new Date(startDate) : new Date(Math.min(...dates.map((d) => new Date(d).getTime())));
  const end = targetDate ? new Date(targetDate) : new Date();
  if (end < start) return [];

  const total = tasks.length;
  const days: BurndownPoint[] = [];
  const msDay = 86400000;
  const span = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msDay));
  const step = span > 60 ? Math.ceil(span / 30) : 1;
  const today = new Date();

  for (let i = 0; i <= span; i += step) {
    const d = new Date(start.getTime() + i * msDay);
    if (d > today && d > end) break;
    const remaining = tasks.filter((t) => {
      if (t.status !== "done") return true;
      if (!t.completed_at) return false;
      return new Date(t.completed_at) > d;
    }).length;
    const ideal = Math.max(0, Math.round(total - (total * i) / span));
    days.push({
      date: d.toISOString().slice(5, 10),
      remaining,
      ideal,
    });
    if (d >= today) break;
  }
  return days;
}
