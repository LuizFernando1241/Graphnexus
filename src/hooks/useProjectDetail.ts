import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchProject, updateProject, deleteProject } from "@/lib/api/projects";
import { createNote } from "@/lib/api/notes";
import { createEntityLink } from "@/lib/api/links";
import { invalidateAllEntities } from "@/lib/cache";
import { useEntityDetail, type EntityDetailConfig } from "@/hooks/useEntityDetail";
import type { Project, ProjectStatus } from "@/types/entities";

interface ProjectFormState {
  title: string;
  emoji: string;
  description: string;
  status: ProjectStatus;
  coverColor: string;
  startDate: Date | undefined;
  targetDate: Date | undefined;
  parentId: string | null;
}

export function useProjectDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  // Config específica para Project
  const config: EntityDetailConfig<Project, ProjectFormState> = {
    queryKey: "project",
    fetchFn: fetchProject,
    updateFn: updateProject,
    deleteFn: deleteProject,
    initialFormState: {
      title: "",
      emoji: "",
      description: "",
      status: "active",
      coverColor: "#7C3AED",
      startDate: undefined,
      targetDate: undefined,
      parentId: null,
    },
    formToPayload: (formState: ProjectFormState, _currentEntity) => {
      return {
        title: formState.title,
        emoji: formState.emoji || null,
        description: formState.description || null,
        status: formState.status,
        cover_color: formState.coverColor,
        start_date: formState.startDate ? format(formState.startDate, "yyyy-MM-dd") : null,
        target_date: formState.targetDate ? format(formState.targetDate, "yyyy-MM-dd") : null,
        parent_id: formState.parentId,
      } as any;
    },
    syncFn: (entity: Project, _formState: ProjectFormState): ProjectFormState => ({
      title: entity.title,
      emoji: entity.emoji || "",
      description: entity.description || "",
      status: entity.status,
      coverColor: entity.cover_color || "#7C3AED",
      startDate: entity.start_date ? new Date(entity.start_date + "T00:00:00") : undefined,
      targetDate: entity.target_date ? new Date(entity.target_date + "T00:00:00") : undefined,
      parentId: entity.parent_id ?? null,
    }),
    navigateToList: "/projects",
    successMessages: {
      save: "Projeto salvo!",
      delete: "Projeto excluído",
      archive: "Projeto arquivado",
    },
  };

  const useEntityDetailState = useEntityDetail<Project, ProjectFormState>(id, config);

  // Extract mutation (específico de Project)
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
        target_type: "project",
        target_id: id,
        label: "Extraído da descrição",
      });

      await updateProject(id, { description: "" });
      return { id: note.id };
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      useEntityDetailState.setFormField("description", "");
      useEntityDetailState.markChanged();
      queryClient.invalidateQueries({ queryKey: ["project", id] });
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
    project: useEntityDetailState.entity,
    isLoading: useEntityDetailState.isLoading,

    // Form state (extraído do formState genérico)
    title: useEntityDetailState.formState.title,
    emoji: useEntityDetailState.formState.emoji,
    description: useEntityDetailState.formState.description,
    status: useEntityDetailState.formState.status,
    coverColor: useEntityDetailState.formState.coverColor,
    startDate: useEntityDetailState.formState.startDate,
    targetDate: useEntityDetailState.formState.targetDate,
    parentId: useEntityDetailState.formState.parentId,
    hasUnsavedChanges: useEntityDetailState.hasUnsavedChanges,

    // Setters (usando setFormField genérico)
    setTitle: (value: string) => useEntityDetailState.setFormField("title", value),
    setEmoji: (value: string) => useEntityDetailState.setFormField("emoji", value),
    setDescription: (value: string) => useEntityDetailState.setFormField("description", value),
    setStatus: (value: ProjectStatus) => useEntityDetailState.setFormField("status", value),
    setCoverColor: (value: string) => useEntityDetailState.setFormField("coverColor", value),
    setStartDate: (value: Date | undefined) => useEntityDetailState.setFormField("startDate", value),
    setTargetDate: (value: Date | undefined) => useEntityDetailState.setFormField("targetDate", value),
    setParentId: (value: string | null) => useEntityDetailState.setFormField("parentId", value),

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
