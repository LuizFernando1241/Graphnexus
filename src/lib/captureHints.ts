// Aprendizado leve em localStorage. Guarda as últimas correções do usuário
// sobre o que a IA propôs, e devolve dicas curtas para injetar no prompt.

const KEY = "nexus.captureHints.v1";
const MAX_ITEMS = 30;
const MAX_HINTS = 6;

export interface HintEntry {
  field: string;       // ex: "priority", "due_time", "project_id", "kind"
  from: string | null; // valor que a IA sugeriu
  to: string | null;   // valor que o usuário corrigiu
  context: string;     // primeiros 60 chars do input original
  at: number;          // timestamp
}

function read(): HintEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: HintEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ITEMS)));
  } catch {
    // ignore quota
  }
}

export function recordCorrection(entry: Omit<HintEntry, "at">) {
  const all = read();
  all.push({ ...entry, at: Date.now() });
  write(all);
}

/** Resume os padrões mais frequentes em frases curtas para o system prompt. */
export function getHintPhrases(): string[] {
  const all = read();
  if (all.length === 0) return [];

  // Conta por (field, to)
  const counts = new Map<string, { count: number; from: Set<string>; sample: string }>();
  for (const e of all) {
    const k = `${e.field}::${e.to ?? "null"}`;
    const cur = counts.get(k) || { count: 0, from: new Set<string>(), sample: e.context };
    cur.count += 1;
    if (e.from) cur.from.add(e.from);
    counts.set(k, cur);
  }

  const sorted = Array.from(counts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_HINTS);

  return sorted.map(([k, v]) => {
    const [field, to] = k.split("::");
    const froms = Array.from(v.from).slice(0, 2).join(" ou ");
    if (field === "priority") {
      return `Costuma marcar prioridade como "${to}" quando o texto parece "${v.sample}".`;
    }
    if (field === "kind") {
      return `Costuma preferir tipo "${to}" para textos como "${v.sample}".`;
    }
    if (field === "project_id" && to && to !== "null") {
      return `Costuma vincular ao projeto ${to} em textos parecidos com "${v.sample}".`;
    }
    if (field === "due_time") {
      return `Costuma usar horário "${to}" em textos como "${v.sample}".`;
    }
    return `Tende a corrigir ${field} de ${froms || "(vazio)"} para "${to}".`;
  });
}
