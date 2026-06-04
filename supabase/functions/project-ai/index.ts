// Edge function: project AI tools (summary, milestones, status suggestion)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TaskLite { title: string; status: string; due_date?: string | null }
interface NoteLite { title: string }
interface ProjectLite {
  title: string;
  description?: string | null;
  status: string;
  start_date?: string | null;
  target_date?: string | null;
  updated_at?: string | null;
}

interface ReqBody {
  type: "summary" | "milestones" | "status";
  project: ProjectLite;
  tasks?: TaskLite[];
  notes?: NoteLite[];
  today?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.type || !body?.project) return json({ error: "Invalid body" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const today = body.today || new Date().toISOString().slice(0, 10);
    const tasks = (body.tasks || []).slice(0, 100);
    const notes = (body.notes || []).slice(0, 50);

    const ctx = [
      `Projeto: ${body.project.title}`,
      `Status atual: ${body.project.status}`,
      body.project.start_date ? `Início: ${body.project.start_date}` : null,
      body.project.target_date ? `Alvo: ${body.project.target_date}` : null,
      body.project.updated_at ? `Última atualização: ${body.project.updated_at}` : null,
      body.project.description ? `Descrição:\n${body.project.description.slice(0, 2000)}` : null,
      tasks.length
        ? `Tarefas (${tasks.length}):\n${tasks.map((t) => `- [${t.status}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("\n")}`
        : "Sem tarefas vinculadas.",
      notes.length ? `Notas (${notes.length}):\n${notes.map((n) => `- ${n.title}`).join("\n")}` : null,
      `Hoje: ${today}`,
    ].filter(Boolean).join("\n\n");

    let payload: Record<string, unknown>;

    if (body.type === "summary") {
      payload = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um PM. Escreva em português, 3-5 linhas, tom executivo, factual. Sem markdown pesado. Inclua: progresso, foco atual, riscos/bloqueios se houver." },
          { role: "user", content: ctx },
        ],
      };
    } else if (body.type === "milestones") {
      payload = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você quebra projetos em milestones e tarefas acionáveis em português. Gere 3 a 6 milestones, cada um com 2 a 5 tarefas curtas e claras. Use o contexto fornecido." },
          { role: "user", content: ctx },
        ],
        tools: [{
          type: "function",
          function: {
            name: "propose_milestones",
            description: "Propõe milestones e tarefas.",
            parameters: {
              type: "object",
              properties: {
                milestones: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      tasks: { type: "array", items: { type: "string" } },
                    },
                    required: ["title", "tasks"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["milestones"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "propose_milestones" } },
      };
    } else if (body.type === "status") {
      payload = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Analise o projeto e sugira um status entre: active, paused, completed, archived. Responda chamando a tool." },
          { role: "user", content: ctx },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_status",
            description: "Sugere status do projeto.",
            parameters: {
              type: "object",
              properties: {
                suggested_status: { type: "string", enum: ["active", "paused", "completed", "archived"] },
                reason: { type: "string" },
              },
              required: ["suggested_status", "reason"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_status" } },
      };
    } else {
      return json({ error: "Invalid type" }, 400);
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.status === 429) return json({ error: "Rate limit" }, 429);
    if (resp.status === 402) return json({ error: "Payment required" }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const msg = data.choices?.[0]?.message;

    if (body.type === "summary") {
      const text = (msg?.content || "").trim();
      return json({ summary: text });
    }

    const call = msg?.tool_calls?.[0];
    if (!call?.function?.arguments) return json({ error: "No tool call" }, 502);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(call.function.arguments); }
    catch { return json({ error: "Invalid AI response" }, 502); }
    return json(parsed);
  } catch (e) {
    console.error("project-ai error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
