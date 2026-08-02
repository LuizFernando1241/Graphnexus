import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, ChevronRight, ChevronDown, FolderOpen, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/api/projects";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, getProgressBarColor } from "@/lib/projectStatus";
import type { Project, ProjectTree } from "@/types/entities";
import { PageTransition } from "@/components/PageTransition";
import { PageHeader } from "@/components/PageHeader";
import { CreateEntityDialog } from "@/components/CreateEntityDialog";
import { ImportDropzone } from "@/components/import/ImportDropzone";
import { ProjectsGridSkeleton } from "@/components/ui/page-skeleton";

const PROJECT_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#0EA5E9"];

function NewProjectDialog({ projects }: { projects: Project[] }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado!");
    },
    onError: () => toast.error("Erro ao criar projeto"),
  });

  return (
    <CreateEntityDialog
      title="Novo Projeto"
      triggerLabel="Novo Projeto"
      submitLabel="Criar Projeto"
      titlePlaceholder="Nome do projeto"
      colors={PROJECT_COLORS}
      parentOptions={projects}
      parentLabel="Projeto pai (opcional)"
      parentPlaceholder="Nenhum (projeto raiz)"
      isPending={mutation.isPending}
      onSubmit={(v) =>
        mutation.mutateAsync({
          title: v.title.trim() || "Sem título",
          emoji: v.emoji,
          cover_color: v.color,
          parent_id: v.parentId,
        })
      }
    />
  );
}


function ProjectNode({
  node, depth, expandedIds, onToggle,
}: {
  node: ProjectTree; depth: number;
  expandedIds: Set<string>; onToggle: (id: string) => void;
}) {
  const navigate = useNavigate();
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const statusCfg = PROJECT_STATUS_CONFIG[node.status] ?? PROJECT_STATUS_CONFIG.active;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/projects/${node.id}`)}
        onKeyDown={(e) => { if (e.key === "Enter") navigate(`/projects/${node.id}`); }}
        className={cn(
          "group flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors cursor-pointer",
          depth > 0 && "border-l-2",
          depth === 1 && "border-l-primary/50",
          depth === 2 && "border-l-info/50",
          depth >= 3 && "border-l-muted-foreground/40",
        )}
        style={{ marginLeft: depth * 20 }}
      >
        <button
          type="button"
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded hover:bg-muted flex-shrink-0",
            !hasChildren && "invisible",
          )}
          aria-label={isExpanded ? "Colapsar" : "Expandir"}
          onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="text-xl flex-shrink-0" aria-hidden>
          {node.emoji ?? <FolderOpen className="h-5 w-5 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{node.title}</span>
            {hasChildren && (
              <span className="text-xs text-muted-foreground">
                {node.children.length} subprojeto{node.children.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {node.totalTasksRecursive > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[240px]">
                <div className={cn("h-full", getProgressBarColor(node.progressPercent))}
                  style={{ width: `${Math.min(node.progressPercent, 100)}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {node.progressPercent.toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {node.doneTasksRecursive}/{node.totalTasksRecursive}
                {hasChildren && " totais"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sem tarefas</span>
          )}
        </div>

        <Badge variant="outline" className={cn("flex-shrink-0", statusCfg.className)}>
          {statusCfg.label}
        </Badge>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-1.5">
          {node.children.map((child) => (
            <ProjectNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const { projects, projectTree, isLoading } = useProjects();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const allCollapsibleIds = useMemo(() => {
    const ids = new Set<string>();
    function walk(nodes: ProjectTree[]) {
      for (const n of nodes) {
        if (n.children.length > 0) { ids.add(n.id); walk(n.children); }
      }
    }
    walk(projectTree);
    return ids;
  }, [projectTree]);

  const allExpanded = allCollapsibleIds.size > 0 && allCollapsibleIds.size === expandedIds.size;

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (isLoading) return <ProjectsGridSkeleton />;

  return (
    <PageTransition>
      <ImportDropzone defaultType="project">
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Projetos"
            description={`${projects.length} projeto${projects.length !== 1 ? "s" : ""}`}
            actions={
              <>
                {allCollapsibleIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(allCollapsibleIds))}
                  >
                    <FolderTree className="h-4 w-4 mr-1" />
                    {allExpanded ? "Colapsar todos" : "Expandir todos"}
                  </Button>
                )}
                <NewProjectDialog projects={projects} />
              </>
            }
          />


          {projectTree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <FolderKanban className="h-10 w-10" />
              <p>Nenhum projeto ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {projectTree.map((node) => (
                <ProjectNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedIds}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </div>
      </ImportDropzone>
    </PageTransition>
  );
}
