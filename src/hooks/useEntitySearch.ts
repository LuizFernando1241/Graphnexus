import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue, escapeLikePattern } from "@/lib/utils";
import type { Note, Task, Project } from "@/types/entities";
import type { EntityType } from "@/types/entities";

export interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  emoji?: string | null;
}

/**
 * Hook unificado para busca de entidades com debounce server-side.
 * Por baixo, faz queries específicas por tabela mas expõe interface consistente.
 */
export function useEntitySearch(entityType: EntityType, search: string, opts?: { limit?: number }) {
  const debouncedSearch = useDebouncedValue(search);

  const queryKey = ["search", entityType, debouncedSearch, opts?.limit];
  const enabled = debouncedSearch.length > 0;

  const queryFn = async () => {
    if (!debouncedSearch.trim()) return [];

    const searchPattern = `%${escapeLikePattern(debouncedSearch)}%`;
    const limit = opts?.limit;

    switch (entityType) {
      case "note":
        return searchNotes(searchPattern, limit);
      case "task":
        return searchTasks(searchPattern, limit);
      case "project":
        return searchProjects(searchPattern, limit);
      default:
        return [];
    }
  };

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn,
    enabled,
  });

  return { results: data, isLoading };
}

/**
 * Busca em notes: title + content, combina e deduplica.
 */
async function searchNotes(pattern: string, limit?: number): Promise<Note[]> {
  const titleQuery = supabase
    .from("notes")
    .select("*")
    .ilike("title", pattern)
    .eq("archived", false);

  const contentQuery = supabase
    .from("notes")
    .select("*")
    .ilike("content", pattern)
    .eq("archived", false);

  if (limit) {
    titleQuery.limit(limit);
    contentQuery.limit(limit);
  }

  const [titleResult, contentResult] = await Promise.all([titleQuery, contentQuery]);

  if (titleResult.error) throw titleResult.error;
  if (contentResult.error) throw contentResult.error;

  // Combinar e deduplicar por ID
  const combined = new Map<string, Note>();
  (titleResult.data || []).forEach((note: Note) => combined.set(note.id, note));
  (contentResult.data || []).forEach((note: Note) => combined.set(note.id, note));

  // Ordenar: pinned primeiro, depois updated_at
  return Array.from(combined.values()).sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

/**
 * Busca em tasks: title + description, combina e deduplica.
 */
async function searchTasks(pattern: string, limit?: number): Promise<Task[]> {
  const titleQuery = supabase
    .from("tasks")
    .select("*")
    .ilike("title", pattern)
    .eq("archived", false)
    .neq("status", "cancelled");

  const descQuery = supabase
    .from("tasks")
    .select("*")
    .ilike("description", pattern)
    .eq("archived", false)
    .neq("status", "cancelled");

  if (limit) {
    titleQuery.limit(limit);
    descQuery.limit(limit);
  }

  const [titleResult, descResult] = await Promise.all([titleQuery, descQuery]);

  if (titleResult.error) throw titleResult.error;
  if (descResult.error) throw descResult.error;

  // Combinar e deduplicar por ID
  const combined = new Map<string, Task>();
  (titleResult.data || []).forEach((task: Task) => combined.set(task.id, task));
  (descResult.data || []).forEach((task: Task) => combined.set(task.id, task));

  // Ordenar por created_at (mais recentes primeiro)
  return Array.from(combined.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Busca em projects: title + description, combina e deduplica.
 */
async function searchProjects(pattern: string, limit?: number): Promise<Project[]> {
  const titleQuery = supabase
    .from("projects")
    .select("*")
    .ilike("title", pattern)
    .eq("archived", false);

  const descQuery = supabase
    .from("projects")
    .select("*")
    .ilike("description", pattern)
    .eq("archived", false);

  if (limit) {
    titleQuery.limit(limit);
    descQuery.limit(limit);
  }

  const [titleResult, descResult] = await Promise.all([titleQuery, descQuery]);

  if (titleResult.error) throw titleResult.error;
  if (descResult.error) throw descResult.error;

  // Combinar e deduplicar por ID
  const combined = new Map<string, Project>();
  (titleResult.data || []).forEach((project: Project) => combined.set(project.id, project));
  (descResult.data || []).forEach((project: Project) => combined.set(project.id, project));

  // Ordenar por updated_at (mais recentes primeiro)
  return Array.from(combined.values()).sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}
