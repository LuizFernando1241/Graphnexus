// Edge function: parse a free-form task description into structured fields
// via the Lovable AI Gateway using tool calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProjectLite {
  id: string;
  title: string;
}

interface RequestBody {
  text: string;
  projects?: ProjectLite[];
  today?: string;
  timezone?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.text || typeof body.text !== "string" || body.text.length > 1000) {
      return new Response(JSON.stringify({ error: "Invalid text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = body.today || new Date().toISOString().slice(0, 10);
    const tz = body.timezone || "America/Sao_Paulo";
    const projectList = (body.projects || [])
      .slice(0, 50)
      .map((p) => `- id="${p.id}" title="${p.title}"`)
      .join("\n");

    const systemPrompt = `Você extrai campos estruturados de uma tarefa em português brasileiro.
Hoje é ${today} (timezone ${tz}).
Projetos disponíveis (use o id exato se o usuário mencionar @nome ou citar claramente):
${projectList || "(nenhum)"}
Regras:
- title: limpo, sem datas/horas/prioridade/recorrência/tags/projeto/status.
- due_date: "YYYY-MM-DD" ou null.
- due_time: "HH:MM:SS" ou null.
- status: backlog | todo | in_progress | done. Padrão: se due_date <= hoje -> todo; futura -> backlog; sem data -> todo.
- priority: none | low | medium | high | urgent. Detecte sinônimos PT-BR e p1..p4.
- recurrence_rule: formato "every:N:UNIT" onde UNIT é day|week|month|custom_days, ou null.
- recurrence_days: array de inteiros 0-6 (0=Domingo..6=Sábado) quando rule é custom_days, senão null.
- project_id: id exato da lista, ou null.
- tags: array de strings (sem #), ou [].
Sempre responda chamando a tool extract_task.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_task",
          description: "Retorna os campos estruturados da tarefa.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              due_date: { type: ["string", "null"] },
              due_time: { type: ["string", "null"] },
              status: { type: "string", enum: ["backlog", "todo", "in_progress", "done"] },
              priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
              recurrence_rule: { type: ["string", "null"] },
              recurrence_days: {
                type: ["array", "null"],
                items: { type: "integer", minimum: 0, maximum: 6 },
              },
              project_id: { type: ["string", "null"] },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["title", "status", "priority"],
            additionalProperties: false,
          },
        },
      },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.text },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "extract_task" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No tool call in response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", call.function.arguments);
      return new Response(JSON.stringify({ error: "Invalid AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate project_id against the provided list
    if (parsed.project_id && body.projects) {
      const valid = body.projects.some((p) => p.id === parsed.project_id);
      if (!valid) parsed.project_id = null;
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-task-ai error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
