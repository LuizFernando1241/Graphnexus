import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchTask, updateTask, deleteTask } from "@/lib/api/tasks";
import { createNote } from "@/lib/api/notes";
import { createEntityLink } from "@/lib/api/links";
import { invalidateAllEntities } from "@/lib/cache";
import type { Task, TaskStatus, TaskPriority } from "@/types/entities";

export function useTaskDetail(id: string | undefined) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch task
  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  });

  // Form state - specific to tasks
  const [title, setTitleState] = useState("");
  const [description, setDescriptionState] = useState("");
  const [status, setStatusState] = useState<TaskStatus>("backlog");
  const [priority, setPriorityState] = useState<TaskPriority>("none");
  const [dueDate, setDueDateState] = useState<Date | undefined>();
  const [recurrenceRule, setRecurrenceRuleState] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDaysState] = useState<number[] | null>(null);
  const [estimatedMinutes, setEstimatedMinutesState] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync with fetched data
  useEffect(() => {
    if (task && task.id === id && loadedId !== id) {
      setTitleState(task.title);
      setDescriptionState(task.description || "");
      setStatusState(task.status);
      setPriorityState(task.priority);
      setDueDateState(task.due_date ? new Date(task.due_date + "T00:00:00") : undefined);
      setRecurrenceRule(task.recurrence_rule);
      setRecurrenceDays(task.recurrence_days);
      setEstimatedMinutes(task.estimated_minutes?.toString() || "");
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [task, loadedId, id]);

  // Mark as changed
  const markChanged = useCallback(() => setHasUnsavedChanges(true), []);

  // Safe state setters
  const setTitle = useCallback((value: string) => {
    if (isMounted.current) {
      setTitleState(value);
      markChanged();
    }
  }, [markChanged]);

  const setDescription = useCallback((value: string) => {
    if (isMounted.current) {
      setDescriptionState(value);
      markChanged();
    }
  }, [markChanged]);

  const setStatus = useCallback((value: TaskStatus) => {
    if (isMounted.current) {
      setStatusState(value);
      markChanged();
    }
  }, [markChanged]);

  const setPriority = useCallback((value: TaskPriority) => {
    if (isMounted.current) {
      setPriorityState(value);
      markChanged();
    }
  }, [markChanged]);

  const setDueDate = useCallback((value: Date | undefined) => {
    if (isMounted.current) {
      setDueDateState(value);
      markChanged();
    }
  }, [markChanged]);

  const setRecurrenceRule = useCallback((value: string | null) => {
    if (isMounted.current) {
      setRecurrenceRuleState(value);
      markChanged();
    }
  }, [markChanged]);

  const setRecurrenceDays = useCallback((value: number[] | null) => {
    if (isMounted.current) {
      setRecurrenceDaysState(value);
      markChanged();
    }
  }, [markChanged]);

  const setEstimatedMinutes = useCallback((value: string) => {
    if (isMounted.current) {
      setEstimatedMinutesState(value);
      markChanged();
    }
  }, [markChanged]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No task ID");
      return updateTask(id, {
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        recurrence_rule: recurrenceRule,
        recurrence_days: recurrenceDays,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
      });
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      invalidateAllEntities(queryClient);
      toast.success("Tarefa salva!");
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao salvar");
    },
  });

  const handleSave = useCallback(() => saveMutation.mutate(), [saveMutation]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No task ID");
      await deleteTask(id);
    },
    onSuccess: () => {
      invalidateAllEntities(queryClient);
      toast.success("Tarefa excluída");
      navigate("/tasks");
    },
  });

  const handleDelete = useCallback(() => deleteMutation.mutate(), [deleteMutation]);

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No task ID");
      return updateTask(id, { archived: true, status: "todo", completed_at: null });
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      invalidateAllEntities(queryClient);
      toast.success("Tarefa arquivada");
      navigate("/tasks");
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao arquivar");
    },
  });

  const handleArchive = useCallback(() => archiveMutation.mutate(), [archiveMutation]);

  // Extract mutation
  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!description || !id || !task) throw new Error("Sem conteúdo para extrair");

      const note = await createNote({
        title: `Ref: ${task?.title || 'Sem título'}`,
        content: description,
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
      setDescriptionState("");
      setHasUnsavedChanges(false);
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

  // Navigation blocker
  const blocker = useBlocker(hasUnsavedChanges);

  return {
    // Data
    task,
    isLoading,
    
    // Form state
    title,
    description,
    status,
    priority,
    dueDate,
    recurrenceRule,
    recurrenceDays,
    estimatedMinutes,
    hasUnsavedChanges,
    
    // Setters
    setTitle,
    setDescription,
    setStatus,
    setPriority,
    setDueDate,
    setRecurrenceRule,
    setRecurrenceDays,
    setEstimatedMinutes,
    
    // Mutations
    saveMutation,
    deleteMutation,
    archiveMutation,
    extractMutation,
    
    // Actions
    handleSave,
    handleDelete,
    handleArchive,
    handleExtract,
    
    // Blocker
    blocker,
  };
}
