import { supabase } from "@/integrations/supabase/client";
import type { EntityLink, EntityType } from "@/types/entities";

export async function fetchEntityLinks(entityId: string, entityType: EntityType): Promise<EntityLink[]> {
  // Busca segura: duas queries separadas (evita interpolação em .or())
  // Query 1: Entity como source
  const { data: sourceData, error: sourceError } = await supabase
    .from("entity_links")
    .select("*")
    .eq("source_id", entityId)
    .eq("source_type", entityType);
  
  // Query 2: Entity como target
  const { data: targetData, error: targetError } = await supabase
    .from("entity_links")
    .select("*")
    .eq("target_id", entityId)
    .eq("target_type", entityType);
  
  if (sourceError) throw sourceError;
  if (targetError) throw targetError;
  
  // Combinar resultados
  const combined = new Map<string, EntityLink>();
  (sourceData || []).forEach((link) => combined.set(link.id, link as unknown as EntityLink));
  (targetData || []).forEach((link) => combined.set(link.id, link as unknown as EntityLink));
  
  return Array.from(combined.values());
}

export async function createEntityLink(link: {
  source_type: EntityType;
  source_id: string;
  target_type: EntityType;
  target_id: string;
  label?: string;
}) {
  const { data, error } = await supabase
    .from("entity_links")
    .insert({
      source_type: link.source_type,
      source_id: link.source_id,
      target_type: link.target_type,
      target_id: link.target_id,
      label: link.label || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EntityLink;
}

export async function deleteEntityLink(id: string) {
  const { error } = await supabase.from("entity_links").delete().eq("id", id);
  if (error) throw error;
}

// Fetch linked task stats for a project (via entity_links)
export async function fetchLinkedTaskStats(projectId: string) {
  // Get all links where this project is involved
  const links = await fetchEntityLinks(projectId, "project");
  
  // Collect task IDs linked to this project
  const taskIds: string[] = [];
  for (const link of links) {
    if (link.source_type === "task") taskIds.push(link.source_id);
    if (link.target_type === "task") taskIds.push(link.target_id);
  }

  if (taskIds.length === 0) return { total: 0, done: 0 };

  const { data, error } = await supabase
    .from("tasks")
    .select("status")
    .in("id", taskIds);
  if (error) throw error;

  const total = data?.length || 0;
  const done = data?.filter((t) => t.status === "done").length || 0;
  return { total, done };
}
