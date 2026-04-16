import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/entities";
import { isSameDay, parseISO, startOfDay } from "date-fns";

type TaskUpdate = Record<string, unknown>;

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
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    tasks = tasks.filter((t) => {
      if (t.status !== "done") return true;
      if (!t.completed_at) return true;
      return new Date(t.completed_at) >= twoDaysAgo;
    });
  }

  // --- AUTO-PROMOÇÃO DIÁRIA ---
  // Só promove tarefas AGENDADAS PARA HOJE (não futuro nem passado)
  // Normaliza ambas as datas para meia-noite local para evitar problemas de timezone
  const today = startOfDay(new Date());
  const tasksToPromote = tasks.filter(t => {
    if (t.status !== "backlog" || !t.due_date) return false;
    const dueDate = startOfDay(parseISO(t.due_date));
    return isSameDay(dueDate, today);  // Apenas se for EXATAMENTE hoje
  });
  
  if (tasksToPromote.length > 0) {
    // 1. Atualizamos a memória instantaneamente para a interface renderizar sem latência
    tasks = tasks.map(t => {
      if (t.status === "backlog" && t.due_date) {
        const dueDate = startOfDay(parseISO(t.due_date));
        if (isSameDay(dueDate, today)) {
          return { ...t, status: "todo" };
        }
      }
      return t;
    });

    // 2. Disparamos o update silencioso no banco (fire and forget)
    Promise.all(
       tasksToPromote.map(t => supabase.from("tasks").update({ status: "todo" }).eq("id", t.id))
    ).catch(err => console.error("Erro na auto-promoção de tarefas:", err));
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
  
  const rawTask = rowToTask(data as Record<string, unknown>);
  
  // --- AUTO-PROMOÇÃO PARA TAREFA ÚNICA ---
  // Só promove se a tarefa for para HOJE (mesmo dia)
  // Usa startOfDay para garantir comparacao consistente de timezone
  const today = startOfDay(new Date());
  if (rawTask.status === "backlog" && rawTask.due_date) {
    const dueDate = startOfDay(parseISO(rawTask.due_date));
    if (isSameDay(dueDate, today)) {
      rawTask.status = "todo";
      supabase.from("tasks").update({ status: "todo" }).eq("id", rawTask.id).catch(err => console.error("Erro na auto-promoção", err));
    }
  }
  
  return rawTask;
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
  subtasks?: any[] | null;
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
      subtasks: task.subtasks || [],
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
  if (updates.subtasks !== undefined) payload.subtasks = updates.subtasks as unknown;
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
  await supabase.from("entity_links").delete().or(`source_id.eq.${id},target_id.eq.${id}`);
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
