// NexusBot: chat assistant with tools over user's notes/tasks/projects/produtos
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface EntityRef {
  entity_type: string;
  entity_id: string;
  title: string;
  preview?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TODAY = () => new Date().toISOString().slice(0, 10);

const SYSTEM_PROMPT = `Você é o NexusBot, assistente do NexusGraph (sistema pessoal de notas, tarefas, projetos e produtos do radar) em português.

Seu papel:
- Responder perguntas do usuário usando o contexto real do banco dele (notas, tarefas, projetos, produtos).
- SEMPRE use as ferramentas disponíveis para buscar dados antes de responder. Nunca invente.
- Faça busca semântica quando o usuário menciona um tema/assunto.
- Quando citar uma entidade, mencione o título e use a ferramenta get_entity se precisar de detalhes.
- Sugira links/conexões entre entidades quando fizer sentido ("essa nota parece relacionada ao projeto X, quer linkar?").
- Seja conciso e direto. Use markdown leve. Liste entidades em bullets curtos.
- Se não encontrar nada, diga claramente.
- Hoje é ${TODAY()}.`;

const tools = [
  {
    type: "function",
    function: {
      name: "semantic_search",
      description: "Busca semântica em todas as entidades do usuário (notas, tarefas, projetos, produtos). Use quando o usuário menciona um tema, assunto ou palavra-chave.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto da busca em linguagem natural" },
          limit: { type: "number", description: "Quantos resultados (padrão 8, máx 20)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_entity",
      description: "Busca o conteúdo completo de uma entidade específica.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["note", "task", "project", "produto"] },
          entity_id: { type: "string" },
        },
        required: ["entity_type", "entity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent",
      description: "Lista as entidades mais recentes de um tipo.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["note", "task", "project", "produto"] },
          limit: { type: "number", description: "Padrão 10, máx 30" },
        },
        required: ["entity_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_overdue_tasks",
      description: "Lista todas as tarefas atrasadas (due_date < hoje, não concluídas).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_tasks",
      description: "Lista tarefas com vencimento nos próximos N dias.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Padrão 7" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_links",
      description: "Sugere outras entidades semanticamente relacionadas a uma entidade dada. Use quando o usuário pedir conexões ou para identificar links que faltam.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["note", "task", "project", "produto"] },
          entity_id: { type: "string" },
          limit: { type: "number", description: "Padrão 5" },
        },
        required: ["entity_type", "entity_id"],
      },
    },
  },
];

const TABLE: Record<string, string> = {
  note: "notes",
  task: "tasks",
  project: "projects",
  produto: "radar_produtos",
};

function titleField(type: string) {
  return type === "produto" ? "nome" : "title";
}

async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: query.slice(0, 2000),
      dimensions: 1536,
    }),
  });
  if (!r.ok) throw new Error(`embed failed ${r.status}`);
  const j = await r.json();
  return j?.data?.[0]?.embedding ?? [];
}

async function enrichEntities(
  supabase: ReturnType<typeof createClient>,
  rows: Array<{ entity_type: string; entity_id: string; content_preview?: string; similarity?: number }>,
): Promise<EntityRef[]> {
  const grouped: Record<string, string[]> = {};
  rows.forEach((r) => {
    grouped[r.entity_type] = grouped[r.entity_type] || [];
    grouped[r.entity_type].push(r.entity_id);
  });
  const titles: Record<string, string> = {};
  for (const [type, ids] of Object.entries(grouped)) {
    const tf = titleField(type);
    const { data } = await supabase.from(TABLE[type]).select(`id, ${tf}`).in("id", ids);
    (data || []).forEach((d: Record<string, unknown>) => {
      titles[`${type}:${d.id}`] = String(d[tf] ?? "(sem título)");
    });
  }
  return rows.map((r) => ({
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    title: titles[`${r.entity_type}:${r.entity_id}`] ?? "(sem título)",
    preview: r.content_preview,
  }));
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  collectedEntities: EntityRef[],
): Promise<unknown> {
  if (name === "semantic_search") {
    const query = String(args.query || "");
    const limit = Math.min(Number(args.limit) || 8, 20);
    if (!query.trim()) return { error: "empty query" };
    const emb = await embedQuery(query, apiKey);
    const { data, error } = await supabase.rpc("match_entities", {
      query_embedding: emb,
      match_count: limit,
    });
    if (error) return { error: error.message };
    const enriched = await enrichEntities(supabase, (data || []) as never);
    collectedEntities.push(...enriched);
    return { results: enriched.map((e) => ({ ...e, similarity: undefined })) };
  }

  if (name === "get_entity") {
    const type = String(args.entity_type || "");
    const id = String(args.entity_id || "");
    if (!TABLE[type] || !id) return { error: "invalid args" };
    const { data, error } = await supabase.from(TABLE[type]).select("*").eq("id", id).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "not found" };
    const tf = titleField(type);
    collectedEntities.push({
      entity_type: type,
      entity_id: id,
      title: String((data as Record<string, unknown>)[tf] ?? ""),
    });
    // Strip very long fields
    const slim: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 1500) slim[k] = v.slice(0, 1500) + "...";
      else slim[k] = v;
    }
    return slim;
  }

  if (name === "list_recent") {
    const type = String(args.entity_type || "");
    const limit = Math.min(Number(args.limit) || 10, 30);
    if (!TABLE[type]) return { error: "invalid type" };
    const tf = titleField(type);
    const selectCols = type === "task"
      ? `id, ${tf}, status, due_date, priority, updated_at`
      : type === "project"
      ? `id, ${tf}, status, target_date, updated_at`
      : type === "produto"
      ? `id, ${tf}, stage, updated_at`
      : `id, ${tf}, updated_at`;
    const { data, error } = await supabase
      .from(TABLE[type])
      .select(selectCols)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return { error: error.message };
    (data || []).forEach((d: Record<string, unknown>) => {
      collectedEntities.push({
        entity_type: type,
        entity_id: String(d.id),
        title: String(d[tf] ?? ""),
      });
    });
    return { results: data };
  }

  if (name === "list_overdue_tasks") {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, status, priority")
      .lt("due_date", TODAY())
      .not("status", "in", "(done,archived,cancelled)")
      .order("due_date", { ascending: true })
      .limit(50);
    if (error) return { error: error.message };
    (data || []).forEach((d: Record<string, unknown>) => {
      collectedEntities.push({
        entity_type: "task",
        entity_id: String(d.id),
        title: String(d.title ?? ""),
      });
    });
    return { results: data, count: data?.length ?? 0 };
  }

  if (name === "list_upcoming_tasks") {
    const days = Math.min(Number(args.days) || 7, 60);
    const future = new Date();
    future.setDate(future.getDate() + days);
    const end = future.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, status, priority")
      .gte("due_date", TODAY())
      .lte("due_date", end)
      .not("status", "in", "(done,archived,cancelled)")
      .order("due_date", { ascending: true })
      .limit(50);
    if (error) return { error: error.message };
    (data || []).forEach((d: Record<string, unknown>) => {
      collectedEntities.push({
        entity_type: "task",
        entity_id: String(d.id),
        title: String(d.title ?? ""),
      });
    });
    return { results: data, count: data?.length ?? 0 };
  }

  if (name === "suggest_links") {
    const type = String(args.entity_type || "");
    const id = String(args.entity_id || "");
    const limit = Math.min(Number(args.limit) || 5, 15);
    if (!TABLE[type] || !id) return { error: "invalid args" };
    // Get the entity's own embedding to use as query vector
    const { data: emb } = await supabase
      .from("entity_embeddings")
      .select("embedding")
      .eq("entity_type", type)
      .eq("entity_id", id)
      .maybeSingle();
    if (!emb) return { error: "Entity not indexed yet. Reindex first." };
    const { data, error } = await supabase.rpc("match_entities", {
      query_embedding: emb.embedding,
      match_count: limit + 1,
      exclude_type: type,
      exclude_id: id,
    });
    if (error) return { error: error.message };
    const enriched = await enrichEntities(supabase, (data || []) as never);
    collectedEntities.push(...enriched);
    return { suggestions: enriched };
  }

  return { error: `Unknown tool: ${name}` };
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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const { messages: clientMessages } = (await req.json()) as {
      messages: Array<{ role: string; content: string }>;
    };

    if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
      return json({ error: "messages required" }, 400);
    }

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...clientMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const collectedEntities: EntityRef[] = [];
    const MAX_STEPS = 6;

    for (let step = 0; step < MAX_STEPS; step++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools,
          tool_choice: step === MAX_STEPS - 1 ? "none" : "auto",
        }),
      });

      if (aiResp.status === 429) return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos esgotados. Adicione créditos no workspace." }, 402);
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error", aiResp.status, t);
        return json({ error: "Falha no gateway de IA" }, 500);
      }

      const aiJson = await aiResp.json();
      const choice = aiJson?.choices?.[0]?.message;
      if (!choice) return json({ error: "Resposta inválida" }, 500);

      messages.push(choice);

      const toolCalls = choice.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Dedupe entities
        const seen = new Set<string>();
        const uniqueEntities = collectedEntities.filter((e) => {
          const k = `${e.entity_type}:${e.entity_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).slice(0, 20);

        return json({
          message: { role: "assistant", content: choice.content ?? "" },
          entities: uniqueEntities,
        });
      }

      // Execute tools
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await executeTool(tc.function.name, args, supabase, apiKey, collectedEntities);
        } catch (e) {
          result = { error: e instanceof Error ? e.message : "tool error" };
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result),
        });
      }
    }

    return json({
      message: { role: "assistant", content: "Não consegui concluir a resposta (limite de passos atingido)." },
      entities: collectedEntities.slice(0, 20),
    });
  } catch (e) {
    console.error("nexus-chat error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
