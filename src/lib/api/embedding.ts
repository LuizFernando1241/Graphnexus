import { supabase } from "@/integrations/supabase/client";

export type EmbedEntityType = "note" | "task" | "project" | "produto";

/**
 * Fire-and-forget: triggers (re)embedding of an entity and a scoped link scan.
 * Never throws — failures are logged silently so user-facing mutations are never blocked.
 */
export function triggerEmbed(entity_type: EmbedEntityType, entity_id: string) {
  // Fire-and-forget — do not await
  (async () => {
    try {
      const { error } = await supabase.functions.invoke("embed-entity", {
        body: { entity_type, entity_id },
      });
      if (error) {
        console.warn("embed-entity failed", error);
        return;
      }
      // Scoped suggestion scan for this entity (cheap)
      const { error: scanErr } = await supabase.functions.invoke("scan-link-suggestions", {
        body: { entity_type, entity_id },
      });
      if (scanErr) console.warn("scan-link-suggestions failed", scanErr);
    } catch (e) {
      console.warn("triggerEmbed error", e);
    }
  })();
}

export interface LinkSuggestion {
  id: string;
  source_type: EmbedEntityType;
  source_id: string;
  target_type: EmbedEntityType;
  target_id: string;
  score: number;
  reason: string | null;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
}

export async function fetchPendingSuggestions(): Promise<LinkSuggestion[]> {
  const { data, error } = await supabase
    .from("link_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("score", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as LinkSuggestion[];
}

export async function fetchPendingSuggestionsFor(
  entity_type: EmbedEntityType,
  entity_id: string,
): Promise<LinkSuggestion[]> {
  const { data: a } = await supabase
    .from("link_suggestions")
    .select("*")
    .eq("status", "pending")
    .eq("source_type", entity_type)
    .eq("source_id", entity_id);
  const { data: b } = await supabase
    .from("link_suggestions")
    .select("*")
    .eq("status", "pending")
    .eq("target_type", entity_type)
    .eq("target_id", entity_id);
  const map = new Map<string, LinkSuggestion>();
  for (const r of [...(a ?? []), ...(b ?? [])]) map.set((r as LinkSuggestion).id, r as LinkSuggestion);
  return Array.from(map.values()).sort((x, y) => y.score - x.score);
}

export async function dismissSuggestion(id: string) {
  const { error } = await supabase
    .from("link_suggestions")
    .update({ status: "dismissed" })
    .eq("id", id);
  if (error) throw error;
}

export async function acceptSuggestion(s: LinkSuggestion) {
  // If either side is a produto, use radar_entity_links; else entity_links
  const produtoSide = s.source_type === "produto"
    ? { produto_id: s.source_id, other_type: s.target_type, other_id: s.target_id }
    : s.target_type === "produto"
    ? { produto_id: s.target_id, other_type: s.source_type, other_id: s.source_id }
    : null;

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  if (produtoSide) {
    const { error } = await supabase.from("radar_entity_links").insert({
      produto_id: produtoSide.produto_id,
      user_id: uid,
      entity_type: produtoSide.other_type,
      entity_id: produtoSide.other_id,
    });
    if (error && !String(error.message).includes("duplicate")) throw error;
  } else {
    const { error } = await supabase.from("entity_links").insert({
      source_type: s.source_type,
      source_id: s.source_id,
      target_type: s.target_type,
      target_id: s.target_id,
      label: "Sugerido por IA",
    });
    if (error && !String(error.message).includes("duplicate")) throw error;
  }

  await supabase.from("link_suggestions").update({ status: "accepted" }).eq("id", s.id);
}

export async function reindexAll(): Promise<{ queued: number }> {
  // Collect all user entity ids and queue embed calls
  const [{ data: notes }, { data: tasks }, { data: projects }, { data: produtos }] = await Promise.all([
    supabase.from("notes").select("id"),
    supabase.from("tasks").select("id"),
    supabase.from("projects").select("id"),
    supabase.from("radar_produtos").select("id"),
  ]);
  const batches: { entity_type: EmbedEntityType; entity_id: string }[] = [
    ...(notes ?? []).map((r) => ({ entity_type: "note" as const, entity_id: r.id })),
    ...(tasks ?? []).map((r) => ({ entity_type: "task" as const, entity_id: r.id })),
    ...(projects ?? []).map((r) => ({ entity_type: "project" as const, entity_id: r.id })),
    ...(produtos ?? []).map((r) => ({ entity_type: "produto" as const, entity_id: r.id })),
  ];
  // Run in small concurrency to avoid rate limits
  const concurrency = 3;
  let idx = 0;
  async function worker() {
    while (idx < batches.length) {
      const b = batches[idx++];
      try {
        await supabase.functions.invoke("embed-entity", { body: b });
      } catch (e) {
        console.warn("reindex item failed", e);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  // After reindex, do a global scan
  try {
    await supabase.functions.invoke("scan-link-suggestions", { body: {} });
  } catch (e) {
    console.warn("global scan failed", e);
  }
  return { queued: batches.length };
}
