import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createTask } from "@/lib/api/tasks";
import { createNote } from "@/lib/api/notes";
import { createProject } from "@/lib/api/projects";
import { createEntityLink } from "@/lib/api/links";
import { parseTaskInput, type ParsedTaskInput, type ProjectLite } from "@/lib/parseTaskInput";
import type { Task, Note, Project } from "@/types/entities";

export interface QuickCreateOptions {
  // Contexto opcional
  defaultStatus?: string;
  defaultDueDate?: string | null;
  projectId?: string | null;
  projects?: ProjectLite[];
}

export interface QuickCreateResult {
  kind: "task" | "note" | "project";
  id: string;
  title: string;
}

export interface QuickCreateDraft {
  kind: "task" | "note" | "project";
  title: string;
  due_date?: string | null;
  due_time?: string | null;
  status?: string | null;
  priority?: string | null;
  recurrence_rule?: string | null;
  recurrence_days?: number[] | null;
  project_id?: string | null;
  tags?: string[];
  content?: string | null;
  description?: string | null;
  tasks_initial?: { title: string; due_date?: string | null; priority?: string | null }[] | null;
}

/**
 * Hook unificado para criação rápida de entidades.
 * Centraliza mutations, tratamento de erro e vinculação automática.
 */
export function useQuickCreate(opts?: QuickCreateOptions) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (draft: QuickCreateDraft): Promise<QuickCreateResult> => {
      let result: QuickCreateResult;

      if (draft.kind === "task") {
        const task = await createTask({
          title: draft.title,
          status: draft.status || opts?.defaultStatus,
          priority: draft.priority,
          due_date: draft.due_date ?? opts?.defaultDueDate ?? null,
          due_time: draft.due_time,
          recurrence_rule: draft.recurrence_rule,
          recurrence_days: draft.recurrence_days,
        });
        result = { kind: "task", id: task.id, title: task.title };

        // Vincular ao projeto se houver project_match ou projectId fixo
        const targetProjectId = draft.project_id || opts?.projectId;
        if (targetProjectId) {
          try {
            await createEntityLink({
              source_type: "task",
              source_id: task.id,
              target_type: "project",
              target_id: targetProjectId,
            });
          } catch (e) {
            console.warn("Failed to link task to project", e);
          }
        }
      } else if (draft.kind === "note") {
        const note = await createNote({
          title: draft.title,
          content: draft.content,
          tags: draft.tags,
        });
        result = { kind: "note", id: note.id, title: note.title };
      } else {
        // project
        const project = await createProject({
          title: draft.title,
          description: draft.description,
        });
        result = { kind: "project", id: project.id, title: project.title };

        // Criar tarefas iniciais se houver
        if (draft.tasks_initial?.length) {
          for (const ti of draft.tasks_initial.slice(0, 5)) {
            try {
              await createTask({
                title: ti.title,
                priority: ti.priority,
                due_date: ti.due_date || null,
              });
            } catch (e) {
              console.warn("Failed initial task", e);
            }
          }
        }
      }

      // Invalidar queries
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["entity_links"] });

      return result;
    },
    onError: (error) => {
      console.error("Quick create error", error);
      toast.error("Falha ao criar item");
    },
  });

  return {
    create: mutation.mutate,
    createAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/**
 * Helper para criar tarefa simples sem parsing (caso ProjectTasksTab).
 */
export function useQuickCreateTask(opts?: QuickCreateOptions) {
  const { create, isPending } = useQuickCreate(opts);

  const createSimpleTask = (title: string) => {
    create({
      kind: "task",
      title,
      status: opts?.defaultStatus || "todo",
      due_date: opts?.defaultDueDate || null,
    });
  };

  return { createSimpleTask, isPending };
}

/**
 * Helper para criar tarefa com parsing local.
 */
export function useQuickCreateWithParse(opts?: QuickCreateOptions) {
  const { create, isPending } = useQuickCreate(opts);

  const createWithParse = (text: string) => {
    const projects = opts?.projects || [];
    const parsed = parseTaskInput(text, projects);
    create({
      kind: "task",
      title: parsed.title || text.trim(),
      due_date: parsed.due_date,
      due_time: parsed.due_time,
      status: parsed.status || opts?.defaultStatus,
      priority: parsed.priority,
      recurrence_rule: parsed.recurrence_rule,
      recurrence_days: parsed.recurrence_days,
      project_id: parsed.project_match?.id || null,
      tags: parsed.tags,
    });
  };

  return { createWithParse, isPending };
}
