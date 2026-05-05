import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchNote, updateNote, deleteNote } from "@/lib/api/notes";
import { invalidateAllEntities } from "@/lib/cache";
import type { Note } from "@/types/entities";

export function useNoteDetail(id: string | undefined) {
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

  // Fetch note
  const { data: note, isLoading } = useQuery({
    queryKey: ["note", id],
    queryFn: () => fetchNote(id!),
    enabled: !!id,
  });

  // Form state - specific to notes
  const [title, setTitleState] = useState("");
  const [emoji, setEmojiState] = useState("");
  const [content, setContentState] = useState("");
  const [color, setColorState] = useState<string>("#7C3AED");
  const [tags, setTagsState] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync with fetched data
  useEffect(() => {
    if (note && note.id === id && loadedId !== id) {
      setTitleState(note.title);
      setEmojiState(note.emoji || "");
      setContentState(note.content || "");
      setColorState(note.color || "#7C3AED");
      setTagsState(note.tags || []);
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [note, loadedId, id]);

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

  const setContent = useCallback((value: string) => {
    if (isMounted.current) {
      setContentState(value);
      markChanged();
    }
  }, [markChanged]);

  const setColor = useCallback((value: string) => {
    if (isMounted.current) {
      setColorState(value);
      markChanged();
    }
  }, [markChanged]);

  const setTags = useCallback((value: string[]) => {
    if (isMounted.current) {
      setTagsState(value);
      markChanged();
    }
  }, [markChanged]);

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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No note ID");
      const finalTitle = deriveTitle(title, content);
      return updateNote(id, { title: finalTitle, emoji: emoji || null, content, color, tags });
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

  // Pin mutation (toggle)
  const pinMutation = useMutation({
    mutationFn: async () => {
      if (!id || !note) throw new Error("No note");
      return updateNote(id, { pinned: !note.pinned });
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

  // Archive mutation (toggle)
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!id || !note) throw new Error("No note");
      return updateNote(id, { archived: !note.archived });
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No note ID");
      await deleteNote(id);
    },
    onSuccess: () => {
      invalidateAllEntities(queryClient);
      toast.success("Nota excluída");
      navigate("/notes");
    },
    onError: () => {
      toast.error("Erro ao excluir");
    },
  });

  const handleDelete = useCallback(() => deleteMutation.mutate(), [deleteMutation]);

  // Navigation blocker
  const blocker = useBlocker(hasUnsavedChanges);

  return {
    // Data
    note,
    isLoading,
    
    // Form state
    title,
    emoji,
    content,
    color,
    tags,
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
    deleteMutation,
    
    // Actions
    handleSave,
    handlePin,
    handleArchive,
    handleDelete,
    
    // Blocker
    blocker,
    
    // Helper
    deriveTitle,
  };
}
