import { useCallback, useRef, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchNote, updateNote, deleteNote } from "@/lib/api/notes";
import { invalidateAllEntities } from "@/lib/cache";
import { useEntityDetail } from "./useEntityDetail";
import type { Note } from "@/types/entities";

interface NoteFormState {
  title: string;
  emoji: string;
  content: string;
  color: string;
  tags: string[];
}

export function useNoteDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const isMounted = useRef(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-title helper
  const deriveTitle = useCallback((currentTitle: string, htmlContent: string): string => {
    if (currentTitle && currentTitle !== "Sem título") return currentTitle;
    const doc = new DOMParser().parseFromString(htmlContent, "text/html");
    const plain = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    if (!plain) return "Sem título";
    const words = plain.split(" ").slice(0, 5).join(" ");
    const derived = words.length > 30 ? words.slice(0, 30) : words;
    return derived + (plain.length > derived.length ? "..." : "");
  }, []);

  // Generic entity detail hook
  const entityDetail = useEntityDetail<Note, NoteFormState>(id, {
    queryKey: "note",
    fetchFn: fetchNote,
    updateFn: updateNote,
    deleteFn: deleteNote,
    initialFormState: {
      title: "",
      emoji: "",
      content: "",
      color: "#7C3AED",
      tags: [],
    },
    formToPayload: (formState, currentEntity) => {
      const finalTitle = deriveTitle(formState.title, formState.content);
      return {
        title: finalTitle,
        emoji: formState.emoji || null,
        content: formState.content,
        color: formState.color,
        tags: formState.tags,
      };
    },
    syncFn: (entity) => ({
      title: entity.title,
      emoji: entity.emoji || "",
      content: entity.content || "",
      color: entity.color || "#7C3AED",
      tags: entity.tags || [],
    }),
    // Note uses default toggle behavior for archive (no archivePayload)
    navigateToList: "/notes",
    successMessages: {
      save: "Nota salva!",
      delete: "Nota excluída",
      archive: "Nota arquivada",
    },
  });

  // Sync hasUnsavedChanges when entity loads
  useEffect(() => {
    if (entityDetail.entity) {
      setHasUnsavedChanges(false);
    }
  }, [entityDetail.entity]);

  // Override save mutation to add extra invalidation for note-tags
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No note ID");
      const finalTitle = deriveTitle(entityDetail.formState.title, entityDetail.formState.content);
      return updateNote(id, {
        title: finalTitle,
        emoji: entityDetail.formState.emoji || null,
        content: entityDetail.formState.content,
        color: entityDetail.formState.color,
        tags: entityDetail.formState.tags,
      });
    },
    onSuccess: () => {
      if (!isMounted.current) return;
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      queryClient.invalidateQueries({ queryKey: ["note-tags"] });
      invalidateAllEntities(queryClient);
      toast.success("Nota salva!");
    },
    onError: () => {
      if (isMounted.current) toast.error("Erro ao salvar");
    },
  });

  const handleSave = useCallback(() => saveMutation.mutate(), [saveMutation]);

  // Pin mutation (Note-specific)
  const pinMutation = useMutation({
    mutationFn: async () => {
      if (!id || !entityDetail.entity) throw new Error("No note");
      return updateNote(id, { pinned: !entityDetail.entity.pinned });
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      invalidateAllEntities(queryClient);
      toast.success(updatedNote.pinned ? "Nota fixada" : "Nota desafixada");
    },
    onError: () => {
      toast.error("Erro ao atualizar");
    },
  });

  const handlePin = useCallback(() => pinMutation.mutate(), [pinMutation]);

  // Override archive mutation to use custom success messages
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id || !entityDetail.entity) throw new Error("No note");
      return updateNote(id, { archived: !entityDetail.entity.archived });
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      invalidateAllEntities(queryClient);
      toast.success(updatedNote.archived ? "Nota arquivada" : "Nota desarquivada");
    },
    onError: () => {
      toast.error("Erro ao atualizar");
    },
  });

  const handleArchive = useCallback(() => archiveMutation.mutate(), [archiveMutation]);

  // Specific setters for Note fields
  const setTitle = useCallback((value: string) => {
    entityDetail.setFormField("title", value);
    setHasUnsavedChanges(true);
  }, [entityDetail]);

  const setEmoji = useCallback((value: string) => {
    entityDetail.setFormField("emoji", value);
    setHasUnsavedChanges(true);
  }, [entityDetail]);

  const setContent = useCallback((value: string) => {
    entityDetail.setFormField("content", value);
    setHasUnsavedChanges(true);
  }, [entityDetail]);

  const setColor = useCallback((value: string) => {
    entityDetail.setFormField("color", value);
    setHasUnsavedChanges(true);
  }, [entityDetail]);

  const setTags = useCallback((value: string[]) => {
    entityDetail.setFormField("tags", value);
    setHasUnsavedChanges(true);
  }, [entityDetail]);

  return {
    // Data
    note: entityDetail.entity,
    isLoading: entityDetail.isLoading,
    
    // Form state
    title: entityDetail.formState.title,
    emoji: entityDetail.formState.emoji,
    content: entityDetail.formState.content,
    color: entityDetail.formState.color,
    tags: entityDetail.formState.tags,
    hasUnsavedChanges,
    
    // Setters
    setTitle,
    setEmoji,
    setContent,
    setColor,
    setTags,
    
    // Mutations
    saveMutation,
    pinMutation,
    archiveMutation,
    deleteMutation: entityDetail.deleteMutation,
    
    // Actions
    handleSave,
    handlePin,
    handleArchive,
    handleDelete: entityDetail.handleDelete,
    
    // Blocker
    blocker: entityDetail.blocker,
    
    // Helper
    deriveTitle,
  };
}
