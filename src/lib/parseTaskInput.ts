import * as chrono from "chrono-node";
import { isToday, isBefore, startOfDay, format } from "date-fns";

const PRIORITY_MAP: { value: string; patterns: string[] }[] = [
  { value: "urgent", patterns: ["urgente", "!urgente", "para ontem", "p1"] },
  { value: "high", patterns: ["prioridade alta", "importante", "!alta", "p2"] },
  { value: "medium", patterns: ["prioridade média", "prioridade media", "normal", "p3"] },
  { value: "low", patterns: ["prioridade baixa", "p4"] },
];

const STATUS_MAP: { value: string; patterns: string[] }[] = [
  { value: "in_progress", patterns: ["em progresso", "fazendo agora", "fazer agora", "\\[em progresso\\]"] },
  { value: "backlog", patterns: ["pro backlog", "deixar pro backlog", "ideia", "\\[backlog\\]"] },
  { value: "done", patterns: ["já feito", "concluído", "\\[done\\]"] },
];

interface ParsedTaskInput {
  title: string;
  due_date: string | null;
  status: string;
  priority: string;
}

function extractFromMap(text: string, map: { value: string; patterns: string[] }[]): { value: string | null; cleaned: string } {
  let cleaned = text;
  for (const entry of map) {
    for (const pattern of entry.patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, "gi");
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, "").replace(/\s{2,}/g, " ").trim();
        return { value: entry.value, cleaned };
      }
    }
  }
  return { value: null, cleaned };
}

export function parseTaskInput(rawText: string): ParsedTaskInput {
  let text = rawText.trim();

  // 1. Extract priority
  const priorityResult = extractFromMap(text, PRIORITY_MAP);
  const priority = priorityResult.value || "none";
  text = priorityResult.cleaned;

  // 2. Extract explicit status
  const statusResult = extractFromMap(text, STATUS_MAP);
  const explicitStatus = statusResult.value;
  text = statusResult.cleaned;

  // 3. Parse date with chrono
  const results = chrono.pt.parse(text);
  let due_date: string | null = null;
  let title = text;

  if (results.length > 0) {
    const match = results[0];
    const date = match.start.date();
    due_date = format(date, "yyyy-MM-dd");
    title = title.replace(match.text, "").replace(/\s{2,}/g, " ").trim();
    if (!title) title = rawText.trim();
  }

  // 4. Determine status: explicit > auto-triage
  let status: string;
  if (explicitStatus) {
    status = explicitStatus;
  } else if (due_date) {
    const today = startOfDay(new Date());
    const dueDay = startOfDay(new Date(due_date + "T00:00:00"));
    status = isBefore(dueDay, today) || isToday(dueDay) ? "todo" : "backlog";
  } else {
    status = "todo";
  }

  return { title, due_date, status, priority };
}
