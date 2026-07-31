import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchTask, updateTask, deleteTask } from "@/lib/api/tasks";
import { createNote } from "@/lib/api/notes";
import { createEntityLink } from "@/lib/api/links";
import { invalidateAllEntities } from "@/lib/cache";
import { useEntityDetail, type EntityDetailConfig } from "@/hooks/useEntityDetail";
import type { Task, TaskStatus, TaskPriority } from "@/types/entities";

interface TaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | undefined;
  dueTime: string;
  recurrenceRule: string | null;
  recurrenceDays: number[] | null;
  estimatedMinutes: string;
}

export function useTaskDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  // Config específica para Task
  const config: EntityDetailConfig<Task, TaskFormState> = {
    queryKey: "task",
    fetchFn: fetchTask,
    updateFn: updateTask,
    deleteFn: deleteTask,
    initialFormState: {
      title: "",
      description: "",
      status: "backlog",
      priority: "none",
      dueDate: undefined,
      dueTime: "",
      recurrenceRule: null,
      recurrenceDays: null,
      estimatedMinutes: "",
    },
    formToPayload: (formState: TaskFormState, currentEntity) => {
      const statusChanged = !!currentEntity && currentEntity.status !== formState.status;
      return {
        title: formState.title,
        description: formState.description || null,
        status: formState.status,
        priority: formState.priority,
        due_date: formState.dueDate ? format(formState.dueDate, "yyyy-MM-dd") : null,
        due_time: formState.dueTime || null,
        recurrence_rule: formState.recurrenceRule,
        recurrence_days: formState.recurrenceDays,
        estimated_minutes: formState.estimatedMinutes ? parseInt(formState.estimatedMinutes, 10) : null,
        manualStatusChange: statusChanged,
      } as any;
    },
    syncFn: (entity: Task, _formState: TaskFormState): TaskFormState => ({
      title: entity.title,
      description: entity.description || "",
      status: entity.status,
      priority: entity.priority,
      dueDate: entity.due_date ? new Date(entity.due_date + "T00:00:00") : undefined,
      dueTime: entity.due_time || "",
      recurrenceRule: entity.recurrence_rule,
      recurrenceDays: entity.recurrence_days,
      estimatedMinutes: entity.estimated_minutes?.toString() || "",
    }),
    archivePayload: { archived: true, status: "todo", completed_at: null } as any,
    navigateToList: "/tasks",
    successMessages: {
      save: "Tarefa salva!",
      delete: "Tarefa excluída",
      archive: "Tarefa arquivada",
    },
  };

  const useEntityDetailState = useEntityDetail<Task, TaskFormState>(id, config);

  // Extract mutation (específico de Task)
  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!useEntityDetailState.formState.description || !id || !useEntityDetailState.entity) {
        throw new Error("Sem conteúdo para extrair");
      }

      const note = await createNote({
        title: `Ref: ${useEntityDetailState.entity.title || 'Sem título'}`,
        content: useEntityDetailState.formState.description,
      });

      await createEntityLink({
        source_type: "note",
        source_id: note.id,
        target_type: "task",
        target_id: id,
        label: "Extraído da descrição",
      });

      await updateTask(id, { description: "" });
      return { id: note.id };
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      useEntityDetailState.setFormField("description", "");
      useEntityDetailState.markChanged();
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      invalidateAllEntities(queryClient);
      toast.success("Nota extraída e vinculada com sucesso!");
    },
    onError: (error) => {
      if (isMounted.current) {
        toast.error(`Erro ao extrair: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      }
    },
  });

  const handleExtract = useCallback(() => extractMutation.mutate(), [extractMutation]);

  return {
    // Data
    task: useEntityDetailState.entity,
    isLoading: useEntityDetailState.isLoading,

    // Form state (extraído do formState genérico)
    title: useEntityDetailState.formState.title,
    description: useEntityDetailState.formState.description,
    status: useEntityDetailState.formState.status,
    priority: useEntityDetailState.formState.priority,
    dueDate: useEntityDetailState.formState.dueDate,
    dueTime: useEntityDetailState.formState.dueTime,
    recurrenceRule: useEntityDetailState.formState.recurrenceRule,
    recurrenceDays: useEntityDetailState.formState.recurrenceDays,
    estimatedMinutes: useEntityDetailState.formState.estimatedMinutes,
    hasUnsavedChanges: useEntityDetailState.hasUnsavedChanges,

    // Setters (usando setFormField genérico)
    setTitle: (value: string) => useEntityDetailState.setFormField("title", value),
    setDescription: (value: string) => useEntityDetailState.setFormField("description", value),
    setStatus: (value: TaskStatus) => useEntityDetailState.setFormField("status", value),
    setPriority: (value: TaskPriority) => useEntityDetailState.setFormField("priority", value),
    setDueDate: (value: Date | undefined) => useEntityDetailState.setFormField("dueDate", value),
    setDueTime: (value: string) => useEntityDetailState.setFormField("dueTime", value),
    setRecurrenceRule: (value: string | null) => useEntityDetailState.setFormField("recurrenceRule", value),
    setRecurrenceDays: (value: number[] | null) => useEntityDetailState.setFormField("recurrenceDays", value),
    setEstimatedMinutes: (value: string) => useEntityDetailState.setFormField("estimatedMinutes", value),

    // Mutations
    saveMutation: useEntityDetailState.saveMutation,
    deleteMutation: useEntityDetailState.deleteMutation,
    archiveMutation: useEntityDetailState.archiveMutation,
    extractMutation,

    // Actions
    handleSave: useEntityDetailState.handleSave,
    handleDelete: useEntityDetailState.handleDelete,
    handleArchive: useEntityDetailState.handleArchive,
    handleExtract,

    // Blocker
    blocker: useEntityDetailState.blocker,
  };
}
