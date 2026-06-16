import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Loader2, CheckSquare, StickyNote, FolderKanban, X, ArrowUp, Calendar, Flag, Folder } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createNote } from "@/lib/api/notes";
import { createTask } from "@/lib/api/tasks";
import { createProject, fetchProjects } from "@/lib/api/projects";
import { deleteNote } from "@/lib/api/notes";
import { deleteTask } from "@/lib/api/tasks";
import { deleteProject } from "@/lib/api/projects";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { getHintPhrases } from "@/lib/captureHints";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, addDays, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Kind = "task" | "note" | "project";

interface Draft {
  kind: Kind;
  title: string;
  due_date?: string | null;
  due_time?: string | null;
  status?: string | null;
  priority?: string | null;
  recurrence_rule?: string | null;
  recurrence_days?: number[] | null;
  project_id?: string | null;
  tags?: string[];
  content?: string | null;
  description?: string | null;
  tasks_initial?: { title: string; due_date?: string | null; priority?: string | null }[] | null;
}

function priorityColor(p?: string | null) {
  switch (p) {
    case "urgent": return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    case "high": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "medium": return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "low": return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function priorityLabel(p?: string | null) {
  return { urgent: "urgente", high: "alta", medium: "média", low: "baixa", none: "sem prioridade" }[p || "none"] || p || "—";
}

function dateLabel(d?: string | null, t?: string | null) {
  if (!d) return null;
  try {
    const dt = parseISO(d);
    let base = format(dt, "EEE d 'de' MMM", { locale: ptBR });
    if (isToday(dt)) base = "hoje";
    else if (isTomorrow(dt)) base = "amanhã";
    if (t) base += ` ${t.slice(0, 5)}`;
    return base;
  } catch {
    return d;
  }
}

function kindIcon(k: Kind) {
  if (k === "task") return <CheckSquare className="h-4 w-4" />;
  if (k === "note") return <StickyNote className="h-4 w-4" />;
  return <FolderKanban className="h-4 w-4" />;
}

function kindLabel(k: Kind) {
  return k === "task" ? "Tarefa" : k === "note" ? "Nota" : "Projeto";
}

interface CaixaProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function Caixa({ externalOpen, onExternalOpenChange }: CaixaProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = useCallback((v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  }, [onExternalOpenChange]);

  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [creating, setCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      // reset depois de fechar
      setTimeout(() => { setText(""); setDrafts(null); setThinking(false); }, 200);
    }
  }, [open]);

  // ---------------- Fallback local instantâneo ----------------
  const localDraft: Draft | null = useMemo(() => {
    if (!text.trim()) return null;
    const projList = projects.map((p) => ({ id: p.id, title: p.title }));
    const parsed = parseTaskInput(text, projList);
    return {
      kind: "task",
      title: parsed.title,
      due_date: parsed.due_date,
      due_time: parsed.due_time,
      status: parsed.status,
      priority: parsed.priority,
      recurrence_rule: parsed.recurrence_rule,
      recurrence_days: parsed.recurrence_days,
      project_id: parsed.project_match?.id ?? null,
      tags: parsed.tags,
    };
  }, [text, projects]);

  // ---------------- Chamada à IA ----------------
  async function analyze() {
    const t = text.trim();
    if (!t) return;
    setThinking(true);
    setDrafts(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.functions.invoke("capture", {
        body: {
          text: t,
          today,
          now: new Date().toISOString(),
          timezone: tz,
          projects: projects.slice(0, 50).map((p) => ({ id: p.id, title: p.title })),
          hints: getHintPhrases(),
        },
      });
      if (error) throw error;
      const result = data as { drafts?: Draft[]; error?: string };
      if (result?.error || !result?.drafts?.length) {
        if (localDraft) {
          setDrafts([localDraft]);
          toast.info("IA indisponível — usei o modo rápido.");
        } else {
          toast.error("Não consegui interpretar. Tente reescrever.");
        }
      } else {
        setDrafts(result.drafts);
      }
    } catch (e) {
      console.error("capture invoke error", e);
      if (localDraft) {
        setDrafts([localDraft]);
        toast.info("IA indisponível — usei o modo rápido.");
      } else {
        toast.error("Falha ao chamar a IA.");
      }
    } finally {
      setThinking(false);
    }
  }

  // ---------------- Criação + Desfazer ----------------
  async function createOne(d: Draft) {
    if (d.kind === "task") {
      const created = await createTask({
        title: d.title,
        status: d.status || undefined,
        priority: d.priority || undefined,
        due_date: d.due_date || null,
        due_time: d.due_time || null,
        recurrence_rule: d.recurrence_rule || null,
        recurrence_days: d.recurrence_days || null,
      });
      return { kind: "task" as const, id: created.id };
    }
    if (d.kind === "note") {
      const created = await createNote({
        title: d.title,
        content: d.content || undefined,
        tags: d.tags || [],
      });
      return { kind: "note" as const, id: created.id };
    }
    const created = await createProject({
      title: d.title,
      description: d.description || undefined,
    });
    // tarefas iniciais
    if (d.tasks_initial?.length) {
      for (const ti of d.tasks_initial.slice(0, 5)) {
        try {
          await createTask({
            title: ti.title,
            priority: ti.priority || undefined,
            due_date: ti.due_date || null,
          });
        } catch (e) { console.warn("Failed initial task", e); }
      }
    }
    return { kind: "project" as const, id: created.id };
  }

  async function deleteCreated(items: { kind: Kind; id: string }[]) {
    for (const it of items) {
      try {
        if (it.kind === "task") await deleteTask(it.id);
        else if (it.kind === "note") await deleteNote(it.id);
        else await deleteProject(it.id);
      } catch (e) { console.warn("undo failed", e); }
    }
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["notes"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function acceptAll() {
    if (!drafts?.length) return;
    setCreating(true);
    const created: { kind: Kind; id: string }[] = [];
    try {
      for (const d of drafts) {
        const c = await createOne(d);
        created.push(c);
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["projects"] });

      const label = created.length === 1
        ? `${kindLabel(created[0].kind)} criada`
        : `${created.length} itens criados`;
      toast.success(label, {
        duration: 10000,
        action: {
          label: "Desfazer",
          onClick: () => {
            deleteCreated(created);
            toast.success("Desfeito.");
          },
        },
      });
      setOpen(false);
      // Navega se for um único item
      if (created.length === 1) {
        const c = created[0];
        const path = c.kind === "task" ? `/tasks/${c.id}` : c.kind === "note" ? `/notes/${c.id}` : `/projects/${c.id}`;
        setTimeout(() => navigate(path), 80);
      }
    } catch (e) {
      console.error("create error", e);
      toast.error("Falha ao criar.");
    } finally {
      setCreating(false);
    }
  }

  function updateDraft(idx: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev?.map((d, i) => i === idx ? { ...d, ...patch } : d) || null);
  }

  function removeDraft(idx: number) {
    setDrafts((prev) => {
      const next = prev?.filter((_, i) => i !== idx) || [];
      return next.length ? next : null;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (drafts) acceptAll(); else analyze();
    } else if (e.key === "Enter" && !e.shiftKey && !drafts) {
      e.preventDefault();
      analyze();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (drafts) setDrafts(null); else setOpen(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-lg p-0 gap-0 overflow-hidden"
          onPointerDownOutside={(e) => { if (creating || thinking) e.preventDefault(); }}
          onInteractOutside={(e) => { if (creating || thinking) e.preventDefault(); }}
        >
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              O que está na sua cabeça?
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-3">
            <Textarea
              ref={textareaRef}
              placeholder='Ex: "ligar pro contador amanhã sobre o DAS"'
              value={text}
              onChange={(e) => { setText(e.target.value); if (drafts) setDrafts(null); }}
              onKeyDown={onKeyDown}
              rows={3}
              className="resize-none text-base min-h-[88px] focus-visible:ring-1"
              disabled={creating}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Enter para analisar · ⌘/Ctrl+Enter para criar direto · Esc para fechar
            </p>
          </div>

          {/* Resultado */}
          {drafts && drafts.length > 0 && (
            <div className="border-t border-border/60 bg-muted/20 px-5 py-3 max-h-[40vh] overflow-y-auto space-y-2">
              <div className="text-xs text-muted-foreground mb-1">
                {drafts.length === 1 ? "Vou criar:" : `Vou criar ${drafts.length} itens:`}
              </div>
              {drafts.map((d, idx) => (
                <DraftRow
                  key={idx}
                  draft={d}
                  projects={projects}
                  onChange={(patch) => updateDraft(idx, patch)}
                  onRemove={() => removeDraft(idx)}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border/60 px-5 py-3 flex items-center justify-between gap-2 bg-background">
            <div className="text-xs text-muted-foreground">
              {thinking && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analisando…
                </span>
              )}
              {!thinking && !drafts && localDraft && (
                <span className="opacity-60">IA vai analisar ao apertar Enter</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {drafts ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setDrafts(null)} disabled={creating}>
                    Voltar
                  </Button>
                  <Button size="sm" onClick={acceptAll} disabled={creating || drafts.length === 0} className="gap-1.5">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5 rotate-90" />}
                    {drafts.length === 1 ? "Criar" : "Criar tudo"}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={analyze} disabled={!text.trim() || thinking} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Analisar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="h-14 w-14 rounded-full shadow-lg transition-all duration-200 active:scale-[0.97]"
        aria-label="Abrir Caixa"
      >
        <Plus className="h-5 w-5" />
      </Button>
    </>
  );
}

// -------------------------------------------------------------
// DraftRow — uma linha com chips clicáveis
// -------------------------------------------------------------

interface DraftRowProps {
  draft: Draft;
  projects: { id: string; title: string }[];
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}

function DraftRow({ draft, projects, onChange, onRemove }: DraftRowProps) {
  const proj = projects.find((p) => p.id === draft.project_id);
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-2.5 group">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-muted-foreground">{kindIcon(draft.kind)}</div>
        <div className="flex-1 min-w-0">
          <input
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full bg-transparent text-sm font-medium outline-none focus:bg-background/40 rounded px-1 -mx-1"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {kindLabel(draft.kind)}
            </span>
            {draft.kind === "task" && (
              <>
                {dateLabel(draft.due_date, draft.due_time) && (
                  <Chip>
                    <Calendar className="h-3 w-3" />
                    {dateLabel(draft.due_date, draft.due_time)}
                  </Chip>
                )}
                {draft.priority && draft.priority !== "none" && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${priorityColor(draft.priority)}`}>
                    <Flag className="h-3 w-3" />
                    {priorityLabel(draft.priority)}
                  </span>
                )}
                {draft.recurrence_rule && (
                  <Chip>↻ {draft.recurrence_rule.replace(/^every:/, "")}</Chip>
                )}
                {proj && (
                  <Chip>
                    <Folder className="h-3 w-3" />
                    {proj.title}
                  </Chip>
                )}
              </>
            )}
            {draft.kind === "project" && draft.tasks_initial?.length ? (
              <Chip>+{draft.tasks_initial.length} tarefas iniciais</Chip>
            ) : null}
            {draft.tags?.length ? (
              <Chip>#{draft.tags.slice(0, 3).join(" #")}</Chip>
            ) : null}
          </div>
          {draft.kind === "note" && draft.content && (
            <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-wrap">
              {draft.content}
            </p>
          )}
          {draft.kind === "project" && draft.description && (
            <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">
              {draft.description}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition rounded p-1 hover:bg-muted text-muted-foreground"
          aria-label="Descartar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}
