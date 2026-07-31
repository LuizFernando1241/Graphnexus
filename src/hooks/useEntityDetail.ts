import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateAllEntities } from "@/lib/cache";

export interface EntityDetailConfig<TEntity, TFormState> {
  queryKey: string;
  fetchFn: (id: string) => Promise<TEntity>;
  updateFn: (id: string, data: Partial<TEntity>) => Promise<TEntity>;
  deleteFn: (id: string) => Promise<void>;
  initialFormState: TFormState;
  formToPayload: (formState: TFormState, currentEntity: TEntity | undefined) => Partial<TEntity>;
  syncFn: (entity: TEntity, formState: TFormState) => TFormState;
  archivePayload?: Partial<TEntity>; // Override para archive (ex: Task usa { archived: true, status: "todo", completed_at: null })
  navigateToList: string;
  successMessages: {
    save: string;
    delete: string;
    archive: string;
  };
}

export function useEntityDetail<TEntity, TFormState>(id: string | undefined, config: EntityDetailConfig<TEntity, TFormState>) {
  const {
    queryKey,
    fetchFn,
    updateFn,
    deleteFn,
    initialFormState,
    formToPayload,
    syncFn,
    archivePayload,
    navigateToList,
    successMessages,
  } = config;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
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
  const [formState, setFormState] = useState<TFormState>(initialFormState);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync with fetched data
  useEffect(() => {
    if (entity && (entity as any).id === id && loadedId !== id) {
      setFormState(syncFn(entity, formState));
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [entity, loadedId, id, syncFn, formState]);

  // Mark as changed
  const markChanged = useCallback(() => setHasUnsavedChanges(true), []);

  // Safe state setter
  const setFormField = useCallback(<K extends keyof TFormState>(field: K, value: TFormState[K]) => {
    if (isMounted.current) {
      setFormState((prev) => ({ ...prev, [field]: value }));
      markChanged();
    }
  }, [markChanged]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No entity ID");
      return updateFn(id, formToPayload(formState, entity));
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [queryKey, id] });
      invalidateAllEntities(queryClient);
      toast.success(successMessages.save);
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao salvar");
    },
  });

  const handleSave = useCallback(() => saveMutation.mutate(), [saveMutation]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No entity ID");
      await deleteFn(id);
    },
    onSuccess: () => {
      invalidateAllEntities(queryClient);
      toast.success(successMessages.delete);
      navigate(navigateToList);
    },
  });

  const handleDelete = useCallback(() => deleteMutation.mutate(), [deleteMutation]);

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No entity ID");
      // Usa archivePayload se fornecido, senão assume toggle padrão
      if (archivePayload) {
        return updateFn(id, archivePayload);
      }
      // Toggle padrão (para Note/Project)
      if (!entity) throw new Error("No entity");
      return updateFn(id, { archived: !((entity as any).archived) } as unknown as Partial<TEntity>);
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [queryKey, id] });
      invalidateAllEntities(queryClient);
      toast.success(successMessages.archive);
      navigate(navigateToList);
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao arquivar");
    },
  });

  const handleArchive = useCallback(() => archiveMutation.mutate(), [archiveMutation]);

  // Navigation blocker
  const blocker = useBlocker(hasUnsavedChanges);

  return {
    entity,
    isLoading,
    formState,
    setFormField,
    hasUnsavedChanges,
    markChanged,
    saveMutation,
    deleteMutation,
    archiveMutation,
    handleSave,
    handleDelete,
    handleArchive,
    blocker,
  };
}
