import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, CheckCircle2, ChevronRight, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchLinkedTasksForProject } from "@/lib/api/projectStats";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { getProgressBarColor } from "@/lib/projectStatus";
import type { ProjectTree, Task } from "@/types/entities";

function findNode(nodes: ProjectTree[], id: string): ProjectTree | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

interface Props {
  projectId: string;
  tasks: Task[];
  onAddSubproject?: () => void;
}

export function ProjectNarrative({ projectId, tasks, onAddSubproject }: Props) {
  const navigate = useNavigate();
  const { projectTree } = useProjects({ showArchived: true });
  const currentNode = useMemo(() => findNode(projectTree, projectId), [projectTree, projectId]);

  // Fallback to direct tasks if tree not yet ready
  const directDone = tasks.filter((t) => t.status === "done").length;
  const directTotal = tasks.length;

  const total = currentNode?.totalTasksRecursive ?? directTotal;
  const done = currentNode?.doneTasksRecursive ?? directDone;
  const percent = currentNode?.progressPercent ?? (directTotal ? Math.round((directDone / directTotal) * 100) : 0);
  const children = currentNode?.children ?? [];

  const today = new Date();
  const tarefasAtrasadas = tasks.filter((t) => {
    if (!t.due_date || t.status === "done") return false;
    return new Date(t.due_date) < today;
  });
  const tarefasEmAndamento = tasks.filter((t) => t.status === "in_progress");
  const proximaTarefa = [...tasks]
    .filter((t) => t.due_date && t.status !== "done")
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

  return (
    <div className="flex flex-col gap-5">
      {/* Narrative card */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Progresso geral</span>
          <span className="text-2xl font-semibold tabular-nums">{percent.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all", getProgressBarColor(percent))}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {done} de {total} tarefas concluídas
          {children.length > 0 && " (incluindo subprojetos)"}
        </p>

        {(tarefasAtrasadas.length > 0 || tarefasEmAndamento.length > 0) && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Requer atenção
            </span>
            {tarefasAtrasadas.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>
                  {tarefasAtrasadas.length} tarefa{tarefasAtrasadas.length > 1 ? "s" : ""} em atraso
                </span>
              </div>
            )}
            {tarefasEmAndamento.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-amber-500" />
                <span>
                  {tarefasEmAndamento.length} tarefa{tarefasEmAndamento.length > 1 ? "s" : ""} em andamento
                </span>
              </div>
            )}
          </div>
        )}

        {tarefasAtrasadas.length === 0 && percent > 0 && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-border">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">
              Sem atrasos.{" "}
              {proximaTarefa
                ? `Próxima entrega: ${new Date(proximaTarefa.due_date!).toLocaleDateString("pt-BR")}`
                : "Continue assim."}
            </span>
          </div>
        )}
      </div>

      {/* Subprojects */}
      {children.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Subprojetos ({children.length})
            </h3>
            {onAddSubproject && (
              <Button size="sm" variant="ghost" onClick={onAddSubproject}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => navigate(`/projects/${child.id}`)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-left"
              >
                <div className="text-xl flex-shrink-0">
                  {child.emoji ?? <FolderOpen className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{child.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {child.progressPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full", getProgressBarColor(child.progressPercent))}
                        style={{ width: `${Math.min(child.progressPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {child.doneTasksRecursive}/{child.totalTasksRecursive}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
      {!onAddSubproject && children.length === 0 && null}
    </div>
  );
}
