// Edge function: "Caixa" — captura inteligente.
// Fase 1: classificar (o que é nota, o que é tarefa, o que é projeto).
// Fase 2: formatar cada item no formato próprio do seu tipo.

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

const NOTE_FORMATS = [
  "reuniao",
  "ideia",
  "referencia",
  "lista",
  "aprendizado",
  "diario",
  "livre",
] as const;

const PRIORITIES = ["none", "low", "medium", "high", "urgent"];
const STATUSES = ["backlog", "todo", "in_progress", "done"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanStr(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** Remove cercas de código que envolvem o markdown inteiro. */
function unfence(md: string): string {
  const m = md.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```$/);
  return (m ? m[1] : md).trim();
}

function normalizeTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().replace(/^#+/, "").toLowerCase().slice(0, 32);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

function normalizeTime(v: unknown): string | null {
  const s = cleanStr(v, 16);
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]), se = Number(m[3] ?? 0);
  if (h > 23 || mi > 59 || se > 59) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(mi)}:${p(se)}`;
}

function normalizeDate(v: unknown): string | null {
  const s = cleanStr(v, 10);
  if (!s || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
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

Trabalhe SEMPRE em duas fases.

════════ FASE 1 — DECIDIR ════════
Quebre o texto em unidades de significado e classifique cada uma. Pergunta-chave:
"isso é algo que EU preciso executar e um dia marcar como concluído?"
- SIM → "task". Sinais: verbo de ação dirigido ao usuário (ligar, comprar, mandar, pagar, agendar, revisar, responder), prazo, compromisso, cobrança.
- NÃO, é informação para consultar depois → "note". Sinais: fato, ideia, resumo, conteúdo de reunião, link, aprendizado, dado, desabafo, lista de referência.
- É uma iniciativa ampla com várias frentes e escopo próprio → "project". Sinais explícitos: "novo projeto", "lançar", "estruturar", "montar do zero". Use com parcimônia — na dúvida entre projeto e tarefa, escolha tarefa.

Regras de desempate:
- Verbo no infinitivo sem sujeito ("comprar cabo") → task.
- Verbo no passado ("comprei o cabo", "falei com o João") → note (é registro, não ação).
- Pergunta sem ação ("será que vale usar X?") → note.
- Texto MISTO (ex.: relato de reunião + coisas a fazer) → crie 1 note com o registro E tasks separadas para cada ação; em cada task defina "linked_to_index" com o índice da note no array de drafts.
- Frase única e curta, puramente acionável → apenas 1 task, sem note.
- Nunca duplique a mesma ação como note e task.
- Se ficar genuinamente ambíguo, escolha UM tipo, explique em "reason" e reduza "confidence".

Preencha "reason" (máx. 90 caracteres) dizendo por que aquele tipo foi escolhido.

════════ FASE 2 — FORMATAR ════════
Só depois de decidir o tipo, escreva o conteúdo no formato daquele tipo.

▸ TASK
- title: imperativo, curto (máx ~70 chars), SEM data, hora, prioridade, projeto ou hashtags.
- description: markdown com o contexto restante que o usuário escreveu (o "porquê", números, nomes, links). Se o título já esgota o texto, use null. Nunca invente contexto.
- subtasks: array de {title} quando o texto lista passos ("primeiro X, depois Y"). Máx 8. Senão [].
- due_date: "YYYY-MM-DD" ou null. Resolva "amanhã", "sexta", "dia 20", "próxima semana" com base em ${today}.
- due_time: "HH:MM:SS" ou null. "manhã"=09:00:00, "tarde"=14:00:00, "noite"=19:00:00, "fim do dia"=18:00:00. "9h" sozinho = manhã.
- priority: none|low|medium|high|urgent. "urgente"=urgent, "importante"=high, "quando der"/"sem pressa"=low.
- recurrence_rule: "every:N:UNIT" (UNIT=day|week|month|custom_days) ou null. "toda segunda" = every:1:custom_days + recurrence_days=[1].
- recurrence_days: array 0-6 (0=dom..6=sáb) quando custom_days, senão null.
- project_id: id EXATO da lista, ou null. Só vincule se a pessoa mencionou claramente.
- tags: array sem "#", minúsculas, ou [].

▸ NOTE
- Escolha "note_format" e siga a estrutura correspondente:
  • "reuniao": ## Contexto / ## Pontos discutidos (lista) / ## Decisões (lista) / ## Próximos passos (lista).
  • "ideia": parágrafo de abertura com a ideia em 1-2 frases / ## Por que / ## Como poderia funcionar (lista).
  • "referencia": 1 linha do que é / lista com os links ou dados / ## Por que guardei.
  • "lista": título de seção opcional + lista com "- " (use "- [ ] " apenas se forem itens a marcar).
  • "aprendizado": ## O que aprendi / ## Onde se aplica.
  • "diario": parágrafos corridos em ordem cronológica, sem seções artificiais.
  • "livre": use quando nenhum formato acima se encaixa — markdown limpo em parágrafos e listas.
- title: curto e descritivo (máx ~60 chars), sem markdown, sem hashtags.
- content: markdown limpo. Corrija pontuação, capitalização e quebras de linha; organize em listas quando fizer sentido. NUNCA invente informação, nomes, números, datas ou conclusões que não estejam no texto. Não envolva a resposta em blocos de código. Não repita o título como H1. Seções vazias devem ser omitidas.
- Texto muito curto (1-2 frases) → não crie seções: só o parágrafo limpo.
- tags: array sem "#", minúsculas, ou [].

▸ PROJECT
- title: nome curto.
- description: 1-2 parágrafos em markdown.
- tasks_initial: até 5 tarefas iniciais (title + opcional priority/due_date) ou [].

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
                    reason: { type: ["string", "null"], description: "por que este tipo foi escolhido" },
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
                    subtasks: {
                      type: ["array", "null"],
                      items: {
                        type: "object",
                        properties: { title: { type: "string" } },
                        required: ["title"],
                      },
                    },
                    linked_to_index: {
                      type: ["integer", "null"],
                      description: "índice (0-based) da note deste mesmo texto à qual esta tarefa pertence",
                    },
                    // note
                    note_format: { type: ["string", "null"], enum: [...NOTE_FORMATS, null] },
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
    } catch (_e) {
      console.error("capture parse error", call.function.arguments);
      return json({ error: "invalid_ai_response" }, 502);
    }

    const validProjectIds = new Set((body.projects || []).map((p) => p.id));
    const rawDrafts = Array.isArray(parsed.drafts) ? parsed.drafts.slice(0, 12) : [];

    const drafts = rawDrafts.map((d) => {
      const r = (d ?? {}) as Record<string, unknown>;
      const kind = r.kind === "note" || r.kind === "project" ? r.kind : "task";
      const title = (cleanStr(r.title, 200) || "Sem título").replace(/^#+\s*/, "");
      const tags = normalizeTags(r.tags);
      const reason = cleanStr(r.reason, 120);

      if (kind === "note") {
        const fmt = typeof r.note_format === "string" && (NOTE_FORMATS as readonly string[]).includes(r.note_format)
          ? r.note_format
          : "livre";
        const content = cleanStr(r.content, 20000);
        return {
          kind,
          title,
          reason,
          tags,
          note_format: fmt,
          content: content ? unfence(content) : null,
        };
      }

      if (kind === "project") {
        const desc = cleanStr(r.description, 8000);
        const tasksInitial = Array.isArray(r.tasks_initial)
          ? r.tasks_initial.slice(0, 5).map((t) => {
              const ti = (t ?? {}) as Record<string, unknown>;
              const p = typeof ti.priority === "string" && PRIORITIES.includes(ti.priority) ? ti.priority : null;
              return {
                title: cleanStr(ti.title, 200) || "Tarefa",
                due_date: normalizeDate(ti.due_date),
                priority: p,
              };
            })
          : [];
        return {
          kind,
          title,
          reason,
          tags,
          description: desc ? unfence(desc) : null,
          tasks_initial: tasksInitial,
        };
      }

      // task
      const due_date = normalizeDate(r.due_date);
      const due_time = normalizeTime(r.due_time);
      let priority = typeof r.priority === "string" && PRIORITIES.includes(r.priority) ? r.priority : null;
      // Status e prioridade derivados da data (determinístico, não confia só no modelo)
      let status = typeof r.status === "string" && STATUSES.includes(r.status) ? r.status : null;
      if (!status) status = due_date && due_date > today ? "backlog" : "todo";
      if (!priority) priority = due_date && due_date <= today ? "medium" : "none";

      const rule = cleanStr(r.recurrence_rule, 64);
      const recurrence_rule = rule && /^every:\d+:(day|week|month|custom_days)$/.test(rule) ? rule : null;
      const recurrence_days = recurrence_rule?.endsWith("custom_days") && Array.isArray(r.recurrence_days)
        ? (r.recurrence_days as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        : null;

      const description = cleanStr(r.description ?? r.content, 8000);
      const subtasks = Array.isArray(r.subtasks)
        ? r.subtasks
            .slice(0, 8)
            .map((s) => cleanStr((s as Record<string, unknown>)?.title, 200))
            .filter((t): t is string => !!t)
            .map((t) => ({ title: t }))
        : [];

      const linkedIdx = Number(r.linked_to_index);
      const linked_to_index =
        Number.isInteger(linkedIdx) && linkedIdx >= 0 && linkedIdx < rawDrafts.length ? linkedIdx : null;

      return {
        kind: "task" as const,
        title,
        reason,
        tags,
        description: description ? unfence(description) : null,
        subtasks,
        due_date,
        due_time,
        status,
        priority,
        recurrence_rule,
        recurrence_days: recurrence_days?.length ? recurrence_days : null,
        project_id:
          typeof r.project_id === "string" && validProjectIds.has(r.project_id) ? r.project_id : null,
        linked_to_index,
      };
    });

    // Um índice só é válido se apontar para uma note
    const finalDrafts = drafts.map((d) => {
      if (d.kind === "task" && d.linked_to_index != null) {
        const target = drafts[d.linked_to_index];
        if (!target || target.kind !== "note") return { ...d, linked_to_index: null };
      }
      return d;
    });

    return json({ drafts: finalDrafts, confidence: parsed.confidence ?? null });
  } catch (e) {
    console.error("capture error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
