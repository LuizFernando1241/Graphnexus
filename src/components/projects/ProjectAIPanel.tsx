import { useState } from "react";
import { Sparkles, ListTree, Activity, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createNote } from "@/lib/api/notes";
import { createTask } from "@/lib/api/tasks";
import { createEntityLink } from "@/lib/api/links";
import { updateProject } from "@/lib/api/projects";
import { invalidateAllEntities } from "@/lib/cache";
import type { Project, Task, Note, ProjectStatus } from "@/types/entities";

interface Props {
  project: Project;
  tasks: Task[];
  notes: Note[];
}

interface MilestoneProposal { title: string; tasks: string[] }

function handleAIError(err: any) {
  const status = err?.context?.status ?? err?.status;
  if (status === 429) return toast.error("Limite de uso atingido. Tente novamente em instantes.");
  if (status === 402) return toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
  toast.error("Falha na IA: " + (err?.message || "erro desconhecido"));
}

export function ProjectAIPanel({ project, tasks, notes }: Props) {
  const qc = useQueryClient();
  const [summary, setSummary] = useState<string>("");
  const [milestones, setMilestones] = useState<MilestoneProposal[] | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [statusSuggestion, setStatusSuggestion] = useState<{ suggested_status: ProjectStatus; reason: string } | null>(null);

  const payload = {
    project: {
      title: project.title,
      description: project.description,
      status: project.status,
      start_date: project.start_date,
      target_date: project.target_date,
      updated_at: project.updated_at,
    },
    tasks: tasks.map((t) => ({ title: t.title, status: t.status, due_date: t.due_date })),
    notes: notes.map((n) => ({ title: n.title })),
  };

  const summaryMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("project-ai", { body: { ...payload, type: "summary" } });
      if (error) throw error;
      return data as { summary: string };
    },
    onSuccess: (d) => setSummary(d.summary || ""),
    onError: handleAIError,
  });

  const milestonesMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("project-ai", { body: { ...payload, type: "milestones" } });
      if (error) throw error;
      return data as { milestones: MilestoneProposal[] };
    },
    onSuccess: (d) => {
      setMilestones(d.milestones || []);
      const all = new Set<string>();
      (d.milestones || []).forEach((m, mi) => m.tasks.forEach((_, ti) => all.add(`${mi}:${ti}`)));
      setSelectedTasks(all);
    },
    onError: handleAIError,
  });

  const statusMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("project-ai", { body: { ...payload, type: "status" } });
      if (error) throw error;
      return data as { suggested_status: ProjectStatus; reason: string };
    },
    onSuccess: (d) => setStatusSuggestion(d),
    onError: handleAIError,
  });

  const saveSummaryAsNote = async () => {
    if (!summary) return;
    try {
      const note = await createNote({ title: `Resumo: ${project.title}`, content: `<p>${summary.replace(/\n/g, "</p><p>")}</p>` });
      await createEntityLink({ source_type: "note", source_id: note.id, target_type: "project", target_id: project.id, label: "Resumo IA" });
      invalidateAllEntities(qc);
      toast.success("Resumo salvo como nota");
    } catch (e) {
      toast.error("Erro ao salvar nota");
    }
  };

  const createMilestoneTasks = async () => {
    if (!milestones) return;
    try {
      let count = 0;
      for (let mi = 0; mi < milestones.length; mi++) {
        const m = milestones[mi];
        for (let ti = 0; ti < m.tasks.length; ti++) {
          if (!selectedTasks.has(`${mi}:${ti}`)) continue;
          const t = await createTask({ title: `[M${mi + 1}] ${m.tasks[ti]}`, status: "backlog" });
          await createEntityLink({ source_type: "task", source_id: t.id, target_type: "project", target_id: project.id, label: m.title });
          count++;
        }
      }
      invalidateAllEntities(qc);
      toast.success(`${count} tarefa${count !== 1 ? "s" : ""} criada${count !== 1 ? "s" : ""}`);
      setMilestones(null);
    } catch (e) {
      toast.error("Erro ao criar tarefas");
    }
  };

  const applyStatus = async () => {
    if (!statusSuggestion) return;
    try {
      await updateProject(project.id, { status: statusSuggestion.suggested_status });
      invalidateAllEntities(qc);
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Status atualizado");
      setStatusSuggestion(null);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const toggleTask = (key: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      <Card className="p-4 space-y-4 border-primary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-semibold">IA do Projeto</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={() => summaryMut.mutate()} disabled={summaryMut.isPending}>
            {summaryMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            Resumo
          </Button>
          <Button variant="outline" size="sm" onClick={() => milestonesMut.mutate()} disabled={milestonesMut.isPending}>
            {milestonesMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ListTree className="mr-1 h-3.5 w-3.5" />}
            Quebrar em milestones
          </Button>
          <Button variant="outline" size="sm" onClick={() => statusMut.mutate()} disabled={statusMut.isPending}>
            {statusMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1 h-3.5 w-3.5" />}
            Status inteligente
          </Button>
        </div>

        {summary && (
          <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {summary}
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="ghost" onClick={saveSummaryAsNote}>
                <Save className="mr-1 h-3.5 w-3.5" /> Salvar como nota
              </Button>
            </div>
          </div>
        )}

        {statusSuggestion && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="font-medium">Sugestão: <span className="text-primary">{statusSuggestion.suggested_status}</span></div>
            <p className="text-xs text-muted-foreground mt-1">{statusSuggestion.reason}</p>
            <div className="mt-2 flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setStatusSuggestion(null)}>Ignorar</Button>
              <Button size="sm" onClick={applyStatus}>Aplicar</Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!milestones} onOpenChange={(o) => !o && setMilestones(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Milestones propostos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {milestones?.map((m, mi) => (
              <div key={mi}>
                <div className="font-medium text-sm mb-2">M{mi + 1}. {m.title}</div>
                <ul className="space-y-1.5 pl-2">
                  {m.tasks.map((t, ti) => {
                    const key = `${mi}:${ti}`;
                    return (
                      <li key={ti} className="flex items-start gap-2 text-sm">
                        <Checkbox checked={selectedTasks.has(key)} onCheckedChange={() => toggleTask(key)} className="mt-0.5" />
                        <span>{t}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMilestones(null)}>Cancelar</Button>
            <Button onClick={createMilestoneTasks} disabled={selectedTasks.size === 0}>
              Criar {selectedTasks.size} tarefa{selectedTasks.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
