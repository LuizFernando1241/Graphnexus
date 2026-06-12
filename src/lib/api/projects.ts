import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/types/entities";
import { triggerEmbed } from "@/lib/api/embedding";

export async function fetchProjects(opts?: { showArchived?: boolean }) {
  let query = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!opts?.showArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Project[];
}

export async function fetchProject(id: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function createProject(project: {
  title: string;
  description?: string;
  emoji?: string;
  cover_color?: string;
  parent_id?: string | null;
}) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      title: project.title,
      description: project.description || null,
      emoji: project.emoji || null,
      cover_color: project.cover_color || "#7C3AED",
      parent_id: project.parent_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  triggerEmbed("project", (data as Project).id);
  return data as Project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "title" | "description" | "status" | "cover_color" | "emoji" | "start_date" | "target_date" | "archived" | "parent_id">>
) {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  triggerEmbed("project", id);
  return data as Project;
}


export async function deleteProject(id: string) {
  await supabase.from("entity_links").delete().or(`source_id.eq.${id},target_id.eq.${id}`);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}
