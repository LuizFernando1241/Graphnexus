// Edge function: "Caixa" — captura inteligente.
// Recebe texto livre + contexto (projetos, hora, fuso, hints de aprendizado).
// Devolve 1 ou mais drafts estruturados (tarefa / nota / projeto) prontos para criação.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProjectLite {
  id: string;
  title: string;
}

interface ReqBody {
  text: string;
  projects?: ProjectLite[];
  today?: string; // YYYY-MM-DD
  now?: string;   // ISO string in user's tz
  timezone?: string;
  hints?: string[]; // padrões aprendidos do usuário
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
    if (!body?.text || typeof body.text !== "string") {
      return json({ error: "Invalid text" }, 400);
    }
    if (body.text.length > 4000) {
      return json({ error: "Text too long" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const today = body.today || new Date().toISOString().slice(0, 10);
    const nowIso = body.now || new Date().toISOString();
    const tz = body.timezone || "America/Sao_Paulo";

    const projectList = (body.projects || [])
      .slice(0, 50)
      .map((p) => `- id="${p.id}" title="${p.title}"`)
      .join("\n");

    const hintsBlock = (body.hints || []).slice(0, 6).map((h) => `- ${h}`).join("\n");

    const systemPrompt = `Você é o cérebro da "Caixa" do NexusGraph — um campo único onde o usuário escreve qualquer coisa em português brasileiro.
Hoje é ${today}, agora é ${nowIso} (timezone ${tz}).

Sua missão: ler o texto e decidir o que criar. Pode ser 1 ou vários itens. Tipos possíveis:
- "task": tem verbo de ação (ligar, comprar, mandar, fazer, agendar, pagar, marcar, preparar...) ou compromisso com data/hora.
- "note": ideia, lembrança, observação, conteúdo de referência, sem ação clara.
- "project": iniciativa grande com escopo ("novo projeto:", "lançar", "começar", "estruturar X"). Use com parcimônia.

Quando o texto tem várias coisas, separe em vários drafts. Se ambíguo, prefira 1 só draft e marque confidence menor.

Regras para tarefas:
- title: limpo, sem datas/horas/prioridade/projeto.
- due_date: "YYYY-MM-DD" ou null. Resolva "amanhã", "sexta", "dia 20", "próxima semana" com base em ${today}.
- due_time: "HH:MM:SS" ou null. "manhã"=09:00, "tarde"=14:00, "noite"=19:00, "fim do dia"=18:00. Se a pessoa só disser "9h" assuma manhã.
- priority: "none" | "low" | "medium" | "high" | "urgent". "urgente"=urgent, "importante"=high, "quando der"/"sem pressa"=low. Default: medium se tem due_date hoje/amanhã, senão none.
- status: "todo" se due_date <= hoje, "backlog" se futura, "todo" se sem data.
- recurrence_rule: "every:N:UNIT" (UNIT=day|week|month|custom_days) ou null. "toda segunda"=every:1:custom_days + recurrence_days=[1].
- recurrence_days: array 0-6 (0=dom..6=sáb) quando custom_days, senão null.
- project_id: id EXATO da lista, ou null. Só vincule se a pessoa mencionou claramente.
- tags: array sem #, ou [].

Regras para notas:
- title: curto, descritivo (max ~60 chars).
- content: o texto formatado em markdown limpo (pode usar listas, negrito, títulos H2/H3). Preserve o sentido.
- tags: array ou [].

Regras para projetos:
- title: nome curto.
- description: 1-2 parágrafos em markdown.
- tasks_initial: até 5 tarefas iniciais sugeridas (só title + opcional priority/due_date), ou [].

Hints aprendidos do usuário (use para ajustar prioridade/projeto/recorrência):
${hintsBlock || "(nenhum)"}

Projetos disponíveis:
${projectList || "(nenhum)"}

Sempre responda chamando a tool "capture_drafts". Não escreva texto fora da tool.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "capture_drafts",
          description: "Retorna a lista de itens a criar a partir do texto da Caixa.",
          parameters: {
            type: "object",
            properties: {
              confidence: { type: "number", description: "0..1 — confiança geral na interpretação" },
              drafts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: { type: "string", enum: ["task", "note", "project"] },
                    title: { type: "string" },
                    // task
                    due_date: { type: ["string", "null"] },
                    due_time: { type: ["string", "null"] },
                    status: { type: ["string", "null"], enum: ["backlog", "todo", "in_progress", "done", null] },
                    priority: { type: ["string", "null"], enum: ["none", "low", "medium", "high", "urgent", null] },
                    recurrence_rule: { type: ["string", "null"] },
                    recurrence_days: {
                      type: ["array", "null"],
                      items: { type: "integer", minimum: 0, maximum: 6 },
                    },
                    project_id: { type: ["string", "null"] },
                    tags: { type: "array", items: { type: "string" } },
                    // note
                    content: { type: ["string", "null"] },
                    // project
                    description: { type: ["string", "null"] },
                    tasks_initial: {
                      type: ["array", "null"],
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          due_date: { type: ["string", "null"] },
                          priority: { type: ["string", "null"] },
                        },
                        required: ["title"],
                      },
                    },
                  },
                  required: ["kind", "title"],
                  additionalProperties: false,
                },
              },
            },
            required: ["drafts"],
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
        tool_choice: { type: "function", function: { name: "capture_drafts" } },
      }),
    });

    if (resp.status === 429) return json({ error: "rate_limited" }, 429);
    if (resp.status === 402) return json({ error: "payment_required" }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      console.error("capture gateway error", resp.status, t);
      return json({ error: "ai_gateway_error" }, 502);
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return json({ error: "no_tool_call" }, 502);

    let parsed: { drafts?: unknown[]; confidence?: number };
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch (e) {
      console.error("capture parse error", call.function.arguments);
      return json({ error: "invalid_ai_response" }, 502);
    }

    // Sanitiza project_id contra a lista enviada
    const validProjectIds = new Set((body.projects || []).map((p) => p.id));
    const drafts = (parsed.drafts || []).map((d) => {
      const draft = d as Record<string, unknown>;
      if (draft.project_id && !validProjectIds.has(draft.project_id as string)) {
        draft.project_id = null;
      }
      return draft;
    });

    return json({ drafts, confidence: parsed.confidence ?? null });
  } catch (e) {
    console.error("capture error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
