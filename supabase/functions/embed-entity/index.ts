// Embed an entity (note/task/project/produto) into entity_embeddings
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EntityType = "note" | "task" | "project" | "produto";

interface ReqBody {
  entity_type: EntityType;
  entity_id: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildText(type: EntityType, row: Record<string, unknown>): string {
  const stripHtml = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (type === "note") {
    return [`Nota: ${row.title}`, row.tags ? `Tags: ${(row.tags as string[]).join(", ")}` : "", stripHtml(row.content)].filter(Boolean).join("\n");
  }
  if (type === "task") {
    return [`Tarefa: ${row.title}`, row.due_date ? `Vencimento: ${row.due_date}` : "", `Status: ${row.status}`, row.priority ? `Prioridade: ${row.priority}` : "", stripHtml(row.description)].filter(Boolean).join("\n");
  }
  if (type === "project") {
    return [`Projeto: ${row.title}`, `Status: ${row.status}`, stripHtml(row.description)].filter(Boolean).join("\n");
  }
  // produto
  return [
    `Produto: ${row.nome}`,
    row.fornecedor ? `Fornecedor: ${row.fornecedor}` : "",
    row.stage ? `Estágio: ${row.stage}` : "",
    row.observacoes ? `Observações: ${stripHtml(row.observacoes)}` : "",
  ].filter(Boolean).join("\n");
}

const TABLE: Record<EntityType, string> = {
  note: "notes",
  task: "tasks",
  project: "projects",
  produto: "radar_produtos",
};

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

    const body = (await req.json()) as ReqBody;
    if (!body.entity_type || !body.entity_id) return json({ error: "Invalid body" }, 400);

    const table = TABLE[body.entity_type];
    if (!table) return json({ error: "Invalid entity_type" }, 400);

    const { data: row, error: rowErr } = await supabase
      .from(table)
      .select("*")
      .eq("id", body.entity_id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return json({ error: "Entity not found" }, 404);

    const text = buildText(body.entity_type, row as Record<string, unknown>);
    if (!text.trim()) return json({ skipped: true, reason: "empty" });

    const hash = await sha256(text);

    // Skip if hash matches
    const { data: existing } = await supabase
      .from("entity_embeddings")
      .select("content_hash")
      .eq("entity_type", body.entity_type)
      .eq("entity_id", body.entity_id)
      .maybeSingle();

    if (existing?.content_hash === hash) {
      return json({ skipped: true, reason: "unchanged" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const embResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });

    if (embResp.status === 429) return json({ error: "Rate limit" }, 429);
    if (embResp.status === 402) return json({ error: "Payment required" }, 402);
    if (!embResp.ok) {
      const t = await embResp.text();
      console.error("Embedding error", embResp.status, t);
      return json({ error: "Embedding failed" }, 500);
    }

    const embData = await embResp.json();
    const embedding = embData?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) return json({ error: "Bad embedding response" }, 500);

    const preview = text.slice(0, 300);

    const { error: upsertErr } = await supabase.rpc("upsert_entity_embedding", {
      p_entity_type: body.entity_type,
      p_entity_id: body.entity_id,
      p_content_hash: hash,
      p_content_preview: preview,
      p_embedding: embedding,
    });

    if (upsertErr) throw upsertErr;

    return json({ ok: true, dims: embedding.length });
  } catch (e) {
    console.error("embed-entity error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
