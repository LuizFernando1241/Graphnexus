// Scan workspace for cross-entity link suggestions using embeddings + AI validation
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EntityType = "note" | "task" | "project" | "produto";

interface ReqBody {
  entity_type?: EntityType;
  entity_id?: string;
  // when both omitted -> full scan over recent entities
  limit?: number;
  min_score?: number;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface EmbRow {
  entity_type: EntityType;
  entity_id: string;
  content_preview: string | null;
  embedding: number[] | string;
  updated_at: string;
}

function parseVec(v: number[] | string): number[] {
  if (Array.isArray(v)) return v;
  return JSON.parse(v as string);
}
function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const minScore = body.min_score ?? 0.72;
    const topK = body.limit ?? 8;

    // Fetch all user embeddings
    const { data: allEmb, error: embErr } = await supabase
      .from("entity_embeddings")
      .select("entity_type,entity_id,content_preview,embedding,updated_at");
    if (embErr) throw embErr;
    if (!allEmb || allEmb.length < 2) return json({ ok: true, created: 0, reason: "insufficient_embeddings" });

    const all = (allEmb as EmbRow[]).map((r) => ({ ...r, vec: parseVec(r.embedding) }));

    // Pick sources: either the specific entity, or the 20 most recently updated
    let sources = all;
    if (body.entity_type && body.entity_id) {
      sources = all.filter((r) => r.entity_type === body.entity_type && r.entity_id === body.entity_id);
      if (sources.length === 0) return json({ ok: true, created: 0, reason: "source_not_indexed" });
    } else {
      sources = [...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 20);
    }

    // Existing links (entity_links + radar_entity_links) to skip already-linked pairs
    const { data: existingLinks } = await supabase
      .from("entity_links")
      .select("source_type,source_id,target_type,target_id");
    const { data: existingRadar } = await supabase
      .from("radar_entity_links")
      .select("produto_id,entity_type,entity_id");

    const linkedSet = new Set<string>();
    const pairKey = (a: { t: string; i: string }, b: { t: string; i: string }) => {
      const k1 = `${a.t}:${a.i}`, k2 = `${b.t}:${b.i}`;
      return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
    };
    for (const l of existingLinks ?? []) {
      linkedSet.add(pairKey({ t: l.source_type, i: l.source_id }, { t: l.target_type, i: l.target_id }));
    }
    for (const l of existingRadar ?? []) {
      linkedSet.add(pairKey({ t: "produto", i: l.produto_id }, { t: l.entity_type, i: l.entity_id }));
    }

    // Existing suggestions (any status) — never re-suggest the same pair
    const { data: existingSugg } = await supabase
      .from("link_suggestions")
      .select("source_type,source_id,target_type,target_id,status");
    const suggestedSet = new Set<string>();
    for (const s of existingSugg ?? []) {
      suggestedSet.add(pairKey({ t: s.source_type, i: s.source_id }, { t: s.target_type, i: s.target_id }));
    }

    // Build candidate pairs
    type Candidate = {
      source_type: EntityType; source_id: string; source_preview: string;
      target_type: EntityType; target_id: string; target_preview: string;
      score: number;
    };
    const candidates: Candidate[] = [];

    for (const src of sources) {
      // top-K similar across other entities (any type, including same type if different entity)
      const scored = all
        .filter((r) => !(r.entity_type === src.entity_type && r.entity_id === src.entity_id))
        .map((r) => ({ r, s: cosine(src.vec, r.vec) }))
        .filter((x) => x.s >= minScore)
        .sort((a, b) => b.s - a.s)
        .slice(0, topK);

      for (const { r, s } of scored) {
        const key = pairKey({ t: src.entity_type, i: src.entity_id }, { t: r.entity_type, i: r.entity_id });
        if (linkedSet.has(key)) continue;
        if (suggestedSet.has(key)) continue;
        candidates.push({
          source_type: src.entity_type,
          source_id: src.entity_id,
          source_preview: src.content_preview || "",
          target_type: r.entity_type,
          target_id: r.entity_id,
          target_preview: r.content_preview || "",
          score: s,
        });
        suggestedSet.add(key); // avoid dup within this scan
      }
    }

    if (candidates.length === 0) return json({ ok: true, created: 0 });

    // Cap to 25 candidates per scan to keep AI call cheap
    const limited = candidates.slice(0, 25);

    // Ask AI to validate + produce short reasons
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiPrompt = `Você é um assistente que analisa pares de itens (notas, tarefas, projetos, produtos) e decide se devem ser vinculados. Para cada par, responda se faz sentido vincular (relate=true) e uma frase curta em português explicando o motivo. Seja conservador: só relate=true se houver relação clara de tema, projeto, produto ou contexto. Pares:\n\n` +
      limited.map((c, i) =>
        `[${i}] A (${c.source_type}): ${c.source_preview.slice(0, 200)}\n    B (${c.target_type}): ${c.target_preview.slice(0, 200)}`
      ).join("\n\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Responda apenas chamando a tool fornecida." },
          { role: "user", content: aiPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "validate_pairs",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "integer" },
                      relate: { type: "boolean" },
                      reason: { type: "string" },
                    },
                    required: ["index", "relate", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "validate_pairs" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limit" }, 429);
    if (aiResp.status === 402) return json({ error: "Payment required" }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      // Fallback: insert all without AI reason
      const rows = limited.map((c) => ({
        user_id: userId,
        source_type: c.source_type, source_id: c.source_id,
        target_type: c.target_type, target_id: c.target_id,
        score: c.score,
        reason: null,
      }));
      const { error } = await supabase.from("link_suggestions").upsert(rows, { ignoreDuplicates: true });
      if (error) console.error(error);
      return json({ ok: true, created: rows.length, fallback: true });
    }

    const aiData = await aiResp.json();
    const call = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let validated: Array<{ index: number; relate: boolean; reason: string }> = [];
    try {
      validated = JSON.parse(call?.function?.arguments || "{}").results || [];
    } catch { /* ignore */ }

    const validMap = new Map<number, { relate: boolean; reason: string }>();
    for (const v of validated) validMap.set(v.index, v);

    const toInsert = limited
      .map((c, i) => ({ c, v: validMap.get(i) }))
      .filter((x) => x.v?.relate)
      .map(({ c, v }) => ({
        user_id: userId,
        source_type: c.source_type, source_id: c.source_id,
        target_type: c.target_type, target_id: c.target_id,
        score: c.score,
        reason: v!.reason,
      }));

    if (toInsert.length === 0) return json({ ok: true, created: 0 });

    // Insert one-by-one to tolerate unique-pair conflicts
    let created = 0;
    for (const row of toInsert) {
      const { error } = await supabase.from("link_suggestions").insert(row);
      if (!error) created++;
    }

    return json({ ok: true, created });
  } catch (e) {
    console.error("scan-link-suggestions error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
