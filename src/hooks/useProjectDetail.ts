import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchProject, updateProject, deleteProject } from "@/lib/api/projects";
import { createNote } from "@/lib/api/notes";
import { createEntityLink } from "@/lib/api/links";
import { invalidateAllEntities } from "@/lib/cache";
import type { Project, ProjectStatus } from "@/types/entities";

export function useProjectDetail(id: string | undefined) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  useEffect(() => {
    // Garante que isMounted volte a true em re-mount (StrictMode roda effects 2x).
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  // Form state - specific to projects
  const [title, setTitleState] = useState("");
  const [emoji, setEmojiState] = useState("");
  const [description, setDescriptionState] = useState("");
  const [status, setStatusState] = useState<ProjectStatus>("active");
  const [coverColor, setCoverColorState] = useState("#7C3AED");
  const [startDate, setStartDateState] = useState<Date | undefined>();
  const [targetDate, setTargetDateState] = useState<Date | undefined>();
  const [parentId, setParentIdState] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync with fetched data
  useEffect(() => {
    if (project && project.id === id && loadedId !== id) {
      setTitleState(project.title);
      setEmojiState(project.emoji || "");
      setDescriptionState(project.description || "");
      setStatusState(project.status);
      setCoverColorState(project.cover_color || "#7C3AED");
      setStartDateState(project.start_date ? new Date(project.start_date + "T00:00:00") : undefined);
      setTargetDateState(project.target_date ? new Date(project.target_date + "T00:00:00") : undefined);
      setParentIdState(project.parent_id ?? null);
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [project, loadedId, id]);


  // Mark as changed
  const markChanged = useCallback(() => setHasUnsavedChanges(true), []);

  // Safe state setters
  const setTitle = useCallback((value: string) => {
    if (isMounted.current) {
      setTitleState(value);
      markChanged();
    }
  }, [markChanged]);

  const setEmoji = useCallback((value: string) => {
    if (isMounted.current) {
      setEmojiState(value);
      markChanged();
    }
  }, [markChanged]);

  const setDescription = useCallback((value: string) => {
    if (isMounted.current) {
      setDescriptionState(value);
      markChanged();
    }
  }, [markChanged]);

  const setStatus = useCallback((value: ProjectStatus) => {
    if (isMounted.current) {
      setStatusState(value);
      markChanged();
    }
  }, [markChanged]);

  const setCoverColor = useCallback((value: string) => {
    if (isMounted.current) {
      setCoverColorState(value);
      markChanged();
    }
  }, [markChanged]);

  const setStartDate = useCallback((value: Date | undefined) => {
    if (isMounted.current) {
      setStartDateState(value);
      markChanged();
    }
  }, [markChanged]);

  const setTargetDate = useCallback((value: Date | undefined) => {
    if (isMounted.current) {
      setTargetDateState(value);
      markChanged();
    }
  }, [markChanged]);

  const setParentId = useCallback((value: string | null) => {
    if (isMounted.current) {
      setParentIdState(value);
      markChanged();
    }
  }, [markChanged]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No project ID");
      return updateProject(id, {
        title,
        emoji: emoji || null,
        description: description || null,
        status,
        cover_color: coverColor,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        target_date: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
        parent_id: parentId,
      });
    },

    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      invalidateAllEntities(queryClient);
      toast.success("Projeto salvo!");
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao salvar");
    },
  });

  const handleSave = useCallback(() => saveMutation.mutate(), [saveMutation]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No project ID");
      await deleteProject(id);
    },
    onSuccess: () => {
      invalidateAllEntities(queryClient);
      toast.success("Projeto excluído");
      navigate("/projects");
    },
  });

  const handleDelete = useCallback(() => deleteMutation.mutate(), [deleteMutation]);

  // Archive mutation (toggle)
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id || !project) throw new Error("No project");
      return updateProject(id, { archived: !project.archived });
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      invalidateAllEntities(queryClient);
      toast.success(project?.archived ? "Projeto desarquivado" : "Projeto arquivado");
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao arquivar");
    },
  });

  const handleArchive = useCallback(() => archiveMutation.mutate(), [archiveMutation]);

  // Extract mutation
  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!description || !id || !project) throw new Error("Sem conteúdo para extrair");

      const note = await createNote({
        title: `Ref: ${project?.title || 'Sem título'}`,
        content: description,
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
      setDescriptionState("");
      setHasUnsavedChanges(false);
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

  // Navigation blocker
  const blocker = useBlocker(hasUnsavedChanges);

  return {
    // Data
    project,
    isLoading,
    
    // Form state
    title,
    emoji,
    description,
    status,
    coverColor,
    startDate,
    targetDate,
    parentId,
    hasUnsavedChanges,

    // Setters
    setTitle,
    setEmoji,
    setDescription,
    setStatus,
    setCoverColor,
    setStartDate,
    setTargetDate,
    setParentId,

    
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
