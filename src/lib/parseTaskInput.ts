import * as chrono from "chrono-node";
import { isToday, isBefore, startOfDay, format, addDays } from "date-fns";

export interface ProjectLite {
  id: string;
  title: string;
}

export interface ParsedTaskInput {
  title: string;
  due_date: string | null;
  due_time: string | null;
  status: string;
  priority: string;
  recurrence_rule: string | null;
  recurrence_days: number[] | null;
  project_match: ProjectLite | null;
  tags: string[];
}

// Normalize for case/accent-insensitive matching.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripMatch(text: string, regex: RegExp): { text: string; matched: boolean } {
  const before = text;
  const after = text.replace(regex, " ").replace(/\s{2,}/g, " ").trim();
  return { text: after, matched: after !== before };
}

// ---------- Priority ----------

const PRIORITY_PATTERNS: { value: string; patterns: RegExp[] }[] = [
  {
    value: "urgent",
    patterns: [
      /\b(urgente|urgentissimo|urgentíssimo|critico|crítico|emergencia|emergência|asap)\b/gi,
      /\bpra?\s+ontem\b/gi,
      /(^|\s)!{2,}(?=\s|$)/g,
      /(^|\s)!?p1\b/gi,
      /(^|\s)!urgent(e)?\b/gi,
    ],
  },
  {
    value: "high",
    patterns: [
      /\b(importante|prioritario|prioritário|prioridade\s+alta)\b/gi,
      /\balta\s+prioridade\b/gi,
      /(^|\s)!?p2\b/gi,
      /(^|\s)!(?:high|alta)\b/gi,
      /(^|\s)!(?=\S)/g, // bare leading !word (low specificity, after others)
    ],
  },
  {
    value: "medium",
    patterns: [
      /\b(prioridade\s+m[eé]dia|normal)\b/gi,
      /(^|\s)!?p3\b/gi,
      /(^|\s)!(?:medium|media|média)\b/gi,
    ],
  },
  {
    value: "low",
    patterns: [
      /\b(prioridade\s+baixa|quando\s+der|qualquer\s+hora|sem\s+pressa)\b/gi,
      /(^|\s)!?p4\b/gi,
      /(^|\s)!(?:low|baixa)\b/gi,
    ],
  },
];

function extractPriority(text: string): { value: string; text: string } {
  for (const { value, patterns } of PRIORITY_PATTERNS) {
    for (const re of patterns) {
      const r = stripMatch(text, re);
      if (r.matched) return { value, text: r.text };
    }
  }
  return { value: "none", text };
}

// ---------- Status ----------

const STATUS_PATTERNS: { value: string; patterns: RegExp[] }[] = [
  {
    value: "done",
    patterns: [
      /\b(j[aá]\s+feito|conclu[ií]do|terminei|pronto|finalizado)\b/gi,
      /\[done\]/gi,
      /\[x\]/gi,
    ],
  },
  {
    value: "in_progress",
    patterns: [
      /\b(em\s+andamento|em\s+progresso|fazendo(?:\s+agora)?|come[çc]ando|wip)\b/gi,
      /\[wip\]/gi,
      /\[em\s+progresso\]/gi,
    ],
  },
  {
    value: "backlog",
    patterns: [
      /\b(backlog|pro\s+backlog|ideia|talvez|quem\s+sabe|algum\s+dia)\b/gi,
      /\[backlog\]/gi,
    ],
  },
  {
    value: "todo",
    patterns: [
      /\[\s\]/gi,
      /\ba\s+fazer\b/gi,
    ],
  },
];

function extractStatus(text: string): { value: string | null; text: string } {
  for (const { value, patterns } of STATUS_PATTERNS) {
    for (const re of patterns) {
      const r = stripMatch(text, re);
      if (r.matched) return { value, text: r.text };
    }
  }
  return { value: null, text };
}

// ---------- Recurrence ----------

// JS getDay(): 0=Sun .. 6=Sat
const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1, "segunda-feira": 1,
  terca: 2, ter: 2, "terca-feira": 2,
  quarta: 3, qua: 3, "quarta-feira": 3,
  quinta: 4, qui: 4, "quinta-feira": 4,
  sexta: 5, sex: 5, "sexta-feira": 5,
  sabado: 6, sab: 6,
};

interface RecurrenceResult {
  rule: string | null;
  days: number[] | null;
  text: string;
}

function extractRecurrence(text: string): RecurrenceResult {
  const original = text;
  const lower = norm(text);

  // "dias úteis" / "seg a sex"
  if (/\b(dias\s+uteis|seg(?:\s+a|-)\s*sex)\b/.test(lower)) {
    const cleaned = text.replace(/\b(dias\s+[uú]teis|seg(?:\s+a|-)\s*sex)\b/gi, " ").replace(/\s{2,}/g, " ").trim();
    return { rule: "every:1:custom_days", days: [1, 2, 3, 4, 5], text: cleaned };
  }
  // "fim de semana"
  if (/\bfim\s+de\s+semana\b/.test(lower)) {
    const cleaned = text.replace(/\bfins?\s+de\s+semana\b/gi, " ").replace(/\s{2,}/g, " ").trim();
    return { rule: "every:1:custom_days", days: [0, 6], text: cleaned };
  }

  // "toda <weekday>" / "todas as <weekday>s"
  const wdMatch = lower.match(/\btodas?\s+(?:as\s+)?(domingo|segunda(?:-feira)?|seg|terca(?:-feira)?|ter|quarta(?:-feira)?|qua|quinta(?:-feira)?|qui|sexta(?:-feira)?|sex|sabado|sab)s?\b/);
  if (wdMatch) {
    const day = WEEKDAY_MAP[wdMatch[1]];
    if (day !== undefined) {
      const re = new RegExp(`\\btodas?\\s+(?:as\\s+)?${wdMatch[1]}s?\\b`, "gi");
      const cleaned = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(re, " ");
      // Strip in original (preserve accents in remaining title) by removing match.text region
      const idx = lower.indexOf(wdMatch[0]);
      const cleanedOrig = (original.slice(0, idx) + " " + original.slice(idx + wdMatch[0].length))
        .replace(/\s{2,}/g, " ").trim();
      void cleaned;
      return { rule: "every:1:custom_days", days: [day], text: cleanedOrig };
    }
  }

  // "a cada N dia|semana|mes"
  const everyN = lower.match(/\ba\s+cada\s+(\d+)\s+(dias?|semanas?|m[eê]s(?:es)?)\b/);
  if (everyN) {
    const n = parseInt(everyN[1], 10);
    let unit: "day" | "week" | "month" = "day";
    if (/semana/.test(everyN[2])) unit = "week";
    else if (/mes|mês/.test(everyN[2])) unit = "month";
    const idx = lower.indexOf(everyN[0]);
    const cleaned = (original.slice(0, idx) + " " + original.slice(idx + everyN[0].length)).replace(/\s{2,}/g, " ").trim();
    return { rule: `every:${n}:${unit}`, days: null, text: cleaned };
  }

  // daily / weekly / monthly aliases
  const tests: { re: RegExp; rule: string }[] = [
    { re: /\b(todo\s+dia|diariamente|di[aá]ria(?:mente)?|#diaria|#diária)\b/gi, rule: "every:1:day" },
    { re: /\b(toda\s+semana|semanalmente|#semanal)\b/gi, rule: "every:1:week" },
    { re: /\b(todo\s+m[eê]s|mensalmente|#mensal)\b/gi, rule: "every:1:month" },
  ];
  for (const t of tests) {
    const r = stripMatch(original, t.re);
    if (r.matched) return { rule: t.rule, days: null, text: r.text };
  }

  return { rule: null, days: null, text: original };
}

// ---------- Time ----------

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function extractTime(text: string): { time: string | null; text: string } {
  // meio-dia / meia-noite / manhã / tarde / noite
  const aliases: { re: RegExp; time: string }[] = [
    { re: /\bmeio[-\s]dia\b/gi, time: "12:00:00" },
    { re: /\bmeia[-\s]noite\b/gi, time: "00:00:00" },
    { re: /\bde\s+manh[aã]\b/gi, time: "09:00:00" },
    { re: /\b[àa]\s+tarde\b/gi, time: "14:00:00" },
    { re: /\b[àa]\s+noite\b/gi, time: "19:00:00" },
  ];
  for (const a of aliases) {
    const r = stripMatch(text, a.re);
    if (r.matched) return { time: a.time, text: r.text };
  }

  // pt: "às 14h", "às 14h30", "14h", "14h30", "9 da manhã"
  const hMatch = text.match(/\b(?:[àa]s\s+)?(\d{1,2})h(\d{2})?\b/i);
  if (hMatch) {
    const h = Math.min(23, parseInt(hMatch[1], 10));
    const m = hMatch[2] ? Math.min(59, parseInt(hMatch[2], 10)) : 0;
    const cleaned = text.replace(hMatch[0], " ").replace(/\s{2,}/g, " ").trim();
    return { time: `${pad2(h)}:${pad2(m)}:00`, text: cleaned };
  }
  // "9:30" / "9:30am" / "2pm"
  const colonMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (colonMatch) {
    let h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const ap = colonMatch[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const cleaned = text.replace(colonMatch[0], " ").replace(/\s{2,}/g, " ").trim();
    return { time: `${pad2(h)}:${pad2(m)}:00`, text: cleaned };
  }
  const apMatch = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (apMatch) {
    let h = parseInt(apMatch[1], 10);
    const ap = apMatch[2].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const cleaned = text.replace(apMatch[0], " ").replace(/\s{2,}/g, " ").trim();
    return { time: `${pad2(h)}:00:00`, text: cleaned };
  }
  return { time: null, text };
}

// ---------- Project (@name) ----------

function extractProject(text: string, projects: ProjectLite[]): { match: ProjectLite | null; text: string } {
  const m = text.match(/(^|\s)@([\p{L}\p{N}_-]+)/u);
  if (!m) return { match: null, text };
  const handle = norm(m[2]);
  const found =
    projects.find((p) => norm(p.title).replace(/\s+/g, "-") === handle) ||
    projects.find((p) => norm(p.title).startsWith(handle)) ||
    projects.find((p) => norm(p.title).includes(handle));
  const cleaned = text.replace(m[0], " ").replace(/\s{2,}/g, " ").trim();
  return { match: found ?? null, text: cleaned };
}

// ---------- Tags (#tag) ----------

function extractTags(text: string): { tags: string[]; text: string } {
  const tags: string[] = [];
  const cleaned = text.replace(/(^|\s)#([\p{L}\p{N}_-]{2,})/gu, (_, pre, tag) => {
    tags.push(tag.toLowerCase());
    return pre;
  }).replace(/\s{2,}/g, " ").trim();
  return { tags, text: cleaned };
}

// ---------- Public API ----------

export function parseTaskInput(rawText: string, projects: ProjectLite[] = []): ParsedTaskInput {
  let text = rawText.trim();

  // Order matters: strip explicit tokens before chrono date parsing.
  const statusR = extractStatus(text);
  text = statusR.text;

  const priorityR = extractPriority(text);
  text = priorityR.text;

  const recurR = extractRecurrence(text);
  text = recurR.text;

  const projR = extractProject(text, projects);
  text = projR.text;

  const tagsR = extractTags(text);
  text = tagsR.text;

  const timeR = extractTime(text);
  text = timeR.text;

  // Date via chrono on the cleaned text
  let due_date: string | null = null;
  const results = chrono.pt.parse(text, new Date(), { forwardDate: true });
  if (results.length > 0) {
    const match = results[0];
    due_date = format(match.start.date(), "yyyy-MM-dd");
    text = text.replace(match.text, " ").replace(/\s{2,}/g, " ").trim();
  }

  // If time was detected but no date, default to today (or tomorrow if past)
  if (timeR.time && !due_date) {
    const now = new Date();
    const [h, m] = timeR.time.split(":").map(Number);
    const todayTarget = new Date(now);
    todayTarget.setHours(h, m, 0, 0);
    const base = todayTarget < now ? addDays(now, 1) : now;
    due_date = format(base, "yyyy-MM-dd");
  }

  // If recurrence on a weekday but no date, set due_date to next occurrence
  if (recurR.rule && recurR.days && recurR.days.length === 1 && !due_date) {
    const target = recurR.days[0];
    const today = new Date();
    let candidate = today;
    for (let i = 0; i < 7; i++) {
      if (candidate.getDay() === target) break;
      candidate = addDays(candidate, 1);
    }
    due_date = format(candidate, "yyyy-MM-dd");
  }

  // Auto-triage status
  let status: string;
  if (statusR.value) {
    status = statusR.value;
  } else if (due_date) {
    const today = startOfDay(new Date());
    const dueDay = startOfDay(new Date(due_date + "T00:00:00"));
    status = isBefore(dueDay, today) || isToday(dueDay) ? "todo" : "backlog";
  } else if (priorityR.value === "urgent" || priorityR.value === "high") {
    status = "todo";
  } else {
    status = "todo";
  }

  const title = text.trim() || rawText.trim();

  return {
    title,
    due_date,
    due_time: timeR.time,
    status,
    priority: priorityR.value,
    recurrence_rule: recurR.rule,
    recurrence_days: recurR.days,
    project_match: projR.match,
    tags: tagsR.tags,
  };
}
