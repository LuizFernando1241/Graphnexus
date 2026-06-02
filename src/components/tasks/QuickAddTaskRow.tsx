import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/lib/api/tasks";
import { createEntityLink } from "@/lib/api/links";
import { fetchProjects } from "@/lib/api/projects";
import { parseTaskInput, type ParsedTaskInput } from "@/lib/parseTaskInput";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface QuickAddTaskRowHandle {
  focus: () => void;
}

interface Props {
  defaultStatus?: string;
  defaultDueDate?: string | null;
  placeholder?: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa", none: "",
};

const RECUR_LABEL = (rule: string): string => {
  if (rule === "every:1:day") return "Diária";
  if (rule === "every:1:week") return "Semanal";
  if (rule === "every:1:month") return "Mensal";
  if (rule === "every:1:custom_days") return "Dias específicos";
  const m = rule.match(/^every:(\d+):(\w+)$/);
  if (m) return `A cada ${m[1]} ${m[2]}`;
  return "Recorrente";
};

function summarize(p: ParsedTaskInput): string {
  const parts: string[] = ["Tarefa criada"];
  if (p.priority && p.priority !== "none") parts.push(`🚩 ${PRIORITY_LABEL[p.priority]}`);
  if (p.due_date) {
    const dt = p.due_time ? `${p.due_date} ${p.due_time.slice(0, 5)}` : p.due_date;
    parts.push(`📅 ${dt}`);
  }
  if (p.recurrence_rule) parts.push(`🔁 ${RECUR_LABEL(p.recurrence_rule)}`);
  if (p.project_match) parts.push(`📁 ${p.project_match.title}`);
  if (p.tags.length > 0) parts.push(`#${p.tags.join(" #")}`);
  return parts.join(" · ");
}

export const QuickAddTaskRow = forwardRef<QuickAddTaskRowHandle, Props>(function QuickAddTaskRow(
  { defaultStatus, defaultDueDate, placeholder = 'ex: Reunião @trabalho amanhã 14h !alta toda semana' },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
    staleTime: 60_000,
  });

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const mutation = useMutation({
    mutationFn: async (parsed: ParsedTaskInput) => {
      const task = await createTask({
        title: parsed.title || text.trim(),
        status: defaultStatus || parsed.status,
        priority: parsed.priority,
        due_date: parsed.due_date ?? defaultDueDate ?? null,
        due_time: parsed.due_time,
        recurrence_rule: parsed.recurrence_rule,
        recurrence_days: parsed.recurrence_days,
      });
      if (parsed.project_match) {
        try {
          await createEntityLink({
            source_type: "task", source_id: task.id,
            target_type: "project", target_id: parsed.project_match.id,
          });
        } catch (e) {
          console.warn("Failed to link task to project", e);
        }
      }
      return { task, parsed };
    },
    onSuccess: ({ parsed }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["entity_links"] });
      setText("");
      toast.success(summarize(parsed));
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const submit = (parsed: ParsedTaskInput) => mutation.mutate(parsed);

  const submitLocal = () => {
    const t = text.trim();
    if (!t) return;
    submit(parseTaskInput(t, projects));
  };

  const submitAI = async () => {
    const t = text.trim();
    if (!t || aiLoading) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-task-ai", {
        body: {
          text: t,
          projects: projects.map((p) => ({ id: p.id, title: p.title })),
          today: new Date().toISOString().slice(0, 10),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Merge AI result into ParsedTaskInput shape, resolving project_id back to project_match
      const projectMatch = data.project_id
        ? projects.find((p) => p.id === data.project_id) ?? null
        : null;
      const parsed: ParsedTaskInput = {
        title: data.title || t,
        due_date: data.due_date ?? null,
        due_time: data.due_time ?? null,
        status: data.status || "todo",
        priority: data.priority || "none",
        recurrence_rule: data.recurrence_rule ?? null,
        recurrence_days: data.recurrence_days ?? null,
        project_match: projectMatch,
        tags: Array.isArray(data.tags) ? data.tags : [],
      };
      submit(parsed);
    } catch (e) {
      console.error(e);
      const msg = (e as Error)?.message || "";
      if (msg.includes("Rate") || msg.includes("429")) toast.error("Limite de IA atingido. Tente novamente em instantes.");
      else if (msg.includes("Payment") || msg.includes("402")) toast.error("Créditos de IA esgotados.");
      else toast.error("IA indisponível — usando interpretação local.");
      submitLocal();
    } finally {
      setAiLoading(false);
    }
  };

  // Ctrl/Cmd+I to invoke AI parse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i" && document.activeElement === inputRef.current) {
        e.preventDefault();
        submitAI();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, projects]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 transition-colors",
        focused ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
      )}
    >
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitLocal();
          } else if (e.key === "Escape") {
            setText("");
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        aria-label="Adicionar tarefa rápida"
        className="flex-1 bg-transparent border-0 outline-none py-2.5 text-sm placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={submitAI}
        disabled={aiLoading || !text.trim()}
        aria-label="Interpretar com IA (Ctrl+I)"
        title="Interpretar com IA (Ctrl+I)"
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </button>
    </div>
  );
});
