import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/entities";
import type { Json, Database } from "@/integrations/supabase/types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

function rowToTask(row: Record<string, unknown>): Task {
  return {
    ...row,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
  } as unknown as Task;
}

export async function fetchTasks(opts?: { includeOldDone?: boolean }) {
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("archived", false)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  let tasks = (data || []).map(rowToTask);

  if (!opts?.includeOldDone) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    tasks = tasks.filter((t) => {
      if (t.status !== "done") return true;
      if (!t.completed_at) return true;
      return new Date(t.completed_at) >= threeDaysAgo;
    });
  }

  return tasks;
}

export async function fetchTask(id: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return rowToTask(data as Record<string, unknown>);
}

export async function createTask(task: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
  estimated_minutes?: number | null;
  recurrence_rule?: string | null;
  recurrence_end_date?: string | null;
  recurrence_parent_id?: string | null;
  recurrence_days?: number[] | null;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: task.title,
      description: task.description || null,
      status: task.status || "backlog",
      priority: task.priority || "none",
      due_date: task.due_date || null,
      estimated_minutes: task.estimated_minutes || null,
      subtasks: [] as unknown as Json,
      recurrence_rule: task.recurrence_rule || null,
      recurrence_end_date: task.recurrence_end_date || null,
      recurrence_parent_id: task.recurrence_parent_id || null,
      recurrence_days: task.recurrence_days || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as Record<string, unknown>);
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "due_date" | "completed_at" | "estimated_minutes" | "subtasks" | "archived" | "recurrence_rule" | "recurrence_end_date" | "recurrence_days">>
) {
  const payload: TaskUpdate = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.due_date !== undefined) payload.due_date = updates.due_date;
  if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;
  if (updates.estimated_minutes !== undefined) payload.estimated_minutes = updates.estimated_minutes;
  if (updates.subtasks !== undefined) payload.subtasks = updates.subtasks as unknown as Json;
  if (updates.archived !== undefined) payload.archived = updates.archived;
  if (updates.recurrence_rule !== undefined) payload.recurrence_rule = updates.recurrence_rule;
  if (updates.recurrence_end_date !== undefined) payload.recurrence_end_date = updates.recurrence_end_date;
  if (updates.recurrence_days !== undefined) (payload as Record<string, unknown>).recurrence_days = updates.recurrence_days;

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as Record<string, unknown>);
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
