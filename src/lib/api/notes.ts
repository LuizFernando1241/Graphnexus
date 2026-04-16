import { supabase } from "@/integrations/supabase/client";
import type { Note } from "@/types/entities";

export async function fetchNotes(opts: {
  search?: string;
  tags?: string[];
  showArchived?: boolean;
}) {
  // Se há busca, usamos duas queries separadas e combinamos (100% seguro, sem interpolação)
  if (opts.search && opts.search.trim()) {
    const searchPattern = `%${opts.search}%`;
    
    // Query 1: Busca no título
    let titleQuery = supabase
      .from("notes")
      .select("*")
      .ilike("title", searchPattern);
    
    // Query 2: Busca no conteúdo
    let contentQuery = supabase
      .from("notes")
      .select("*")
      .ilike("content", searchPattern);
    
    // Aplicar filtros comuns
    if (!opts.showArchived) {
      titleQuery = titleQuery.eq("archived", false);
      contentQuery = contentQuery.eq("archived", false);
    }
    
    if (opts.tags && opts.tags.length > 0) {
      titleQuery = titleQuery.contains("tags", opts.tags);
      contentQuery = contentQuery.contains("tags", opts.tags);
    }
    
    // Executar ambas as queries em paralelo
    const [titleResult, contentResult] = await Promise.all([
      titleQuery,
      contentQuery
    ]);
    
    if (titleResult.error) throw titleResult.error;
    if (contentResult.error) throw contentResult.error;
    
    // Combinar resultados e remover duplicatas (por ID)
    const combined = new Map<string, Note>();
    (titleResult.data || []).forEach((note: Note) => combined.set(note.id, note));
    (contentResult.data || []).forEach((note: Note) => combined.set(note.id, note));
    
    // Ordenar: pinned primeiro, depois updated_at
    return Array.from(combined.values()).sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }
  
  // Sem busca: query normal
  let query = supabase
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!opts.showArchived) {
    query = query.eq("archived", false);
  }

  if (opts.tags && opts.tags.length > 0) {
    query = query.contains("tags", opts.tags);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Note[];
}

export async function fetchNote(id: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Note;
}

export async function createNote(note: {
  title: string;
  emoji?: string;
  color?: string;
  content?: string;
  tags?: string[];
}) {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: note.title,
      emoji: note.emoji || null,
      color: note.color || "#7C3AED",
      content: note.content || null,
      tags: note.tags || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, "title" | "content" | "emoji" | "color" | "tags" | "pinned" | "archived">>
) {
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function deleteNote(id: string) {
  await supabase.from("entity_links").delete().or(`source_id.eq.${id},target_id.eq.${id}`);
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function getAllNoteTags(): Promise<string[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("tags")
    .not("tags", "is", null);
  if (error) throw error;
  const tagSet = new Set<string>();
  (data || []).forEach((row: { tags: string[] | null }) => {
    (row.tags || []).forEach((t: string) => tagSet.add(t));
  });
  return Array.from(tagSet).sort();
}
