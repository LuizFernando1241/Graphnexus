import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createNote } from "@/lib/api/notes";
import { createEntityLink } from "@/lib/api/links";
import type { EntityType } from "@/types/entities";

interface UseEntityDetailOptions<T extends { id: string; title: string; description?: string | null; archived?: boolean }> {
  id: string | undefined;
  entityType: EntityType;
  fetchFn: (id: string) => Promise<T>;
  updateFn: (id: string, data: Partial<T>) => Promise<T>;
  deleteFn: (id: string) => Promise<void>;
  queryKey: string;
  listQueryKey: string;
  navigateTo: string;
}

interface UseEntityDetailReturn<T> {
  // Data
  entity: T | undefined;
  isLoading: boolean;
  
  // Form state
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  hasUnsavedChanges: boolean;
  markChanged: () => void;
  
  // Mutations
  saveMutation: ReturnType<typeof useMutation<T, Error, void>>;
  deleteMutation: ReturnType<typeof useMutation<void, Error, void>>;
  archiveMutation: ReturnType<typeof useMutation<T, Error, void>>;
  extractMutation: ReturnType<typeof useMutation<{ id: string }, Error, void>>;
  
  // Actions
  handleSave: () => void;
  handleDelete: () => void;
  handleArchive: () => void;
  handleExtract: () => void;
  
  // Blocker
  blocker: ReturnType<typeof useBlocker>;
  
  // Reset form
  resetForm: () => void;
}

export function useEntityDetail<T extends { id: string; title: string; description?: string | null }>(
  options: UseEntityDetailOptions<T>
): UseEntityDetailReturn<T> {
  const { 
    id, 
    entityType, 
    fetchFn, 
    updateFn, 
    deleteFn, 
    queryKey, 
    listQueryKey,
    navigateTo 
  } = options;
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Track if component is mounted to avoid state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch entity
  const { data: entity, isLoading } = useQuery({
    queryKey: [queryKey, id],
    queryFn: () => fetchFn(id!),
    enabled: !!id,
  });

  // Form state
  const [title, setTitleState] = useState("");
  const [description, setDescriptionState] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync form state with entity data
  useEffect(() => {
    if (entity && entity.id === id && loadedId !== id) {
      setTitleState(entity.title);
      setDescriptionState(entity.description || "");
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [entity, loadedId, id]);

  // Mark form as changed
  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Safe state setters that check if mounted
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

  // Reset form to entity data
  const resetForm = useCallback(() => {
    if (entity && isMounted.current) {
      setTitleState(entity.title);
      setDescriptionState(entity.description || "");
      setHasUnsavedChanges(false);
    }
  }, [entity]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No entity ID");
      return updateFn(id, { 
        title, 
        description: description || null 
      } as Partial<T>);
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [queryKey, id] });
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      toast.success("Salvo com sucesso!");
    },
    onError: () => {
      if (isMounted.current) {
        toast.error("Erro ao salvar");
      }
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No entity ID");
      await deleteFn(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      toast.success("Excluído com sucesso");
      navigate(navigateTo);
    },
  });

  const handleDelete = useCallback(() => {
    deleteMutation.mutate();
  }, [deleteMutation]);

  // Archive mutation (assumes entity has archived field)
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No entity ID");
      // For tasks, also update status when archiving
      const updates = { archived: true } as Record<string, unknown>;
      if (entityType === 'task') {
        updates.status = 'todo';
        updates.completed_at = null;
      }
      return updateFn(id, updates as Partial<T>);
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      toast.success(entity?.archived ? "Desarquivado" : "Arquivado");
      navigate(navigateTo);
    },
    onError: () => {
      if (isMounted.current) {
        toast.error("Erro ao arquivar");
      }
    },
  });

  const handleArchive = useCallback(() => {
    archiveMutation.mutate();
  }, [archiveMutation]);

  // Extract description to note mutation
  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!description || !id || !entity) {
        throw new Error("Sem conteúdo para extrair");
      }

      // 1. Create note
      const note = await createNote({
        title: `Ref: ${entity.title || 'Sem título'}`,
        content: description,
      });

      // 2. Create link
      await createEntityLink({
        source_type: "note",
        source_id: note.id,
        target_type: entityType,
        target_id: id,
        label: "Extraído da descrição",
      });

      // 3. Clear description
      await updateFn(id, { description: "" } as Partial<T>);

      return { id: note.id };
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setDescriptionState("");
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      queryClient.invalidateQueries({ queryKey: [queryKey, id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast.success("Nota extraída e vinculada com sucesso!");
    },
    onError: (error) => {
      if (isMounted.current) {
        toast.error(`Erro ao extrair: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      }
    },
  });

  const handleExtract = useCallback(() => {
    extractMutation.mutate();
  }, [extractMutation]);

  // Navigation blocker for unsaved changes
  const blocker = useBlocker(hasUnsavedChanges);

  return {
    entity,
    isLoading,
    title,
    setTitle,
    description,
    setDescription,
    hasUnsavedChanges,
    markChanged,
    saveMutation,
    deleteMutation,
    archiveMutation,
    extractMutation,
    handleSave,
    handleDelete,
    handleArchive,
    handleExtract,
    blocker,
    resetForm,
  };
}
