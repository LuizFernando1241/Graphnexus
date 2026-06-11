import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderKanban, ChevronRight, ChevronDown, FolderOpen, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/api/projects";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus, ProjectTree } from "@/types/entities";
import { PageTransition } from "@/components/PageTransition";
import { ImportDropzone } from "@/components/import/ImportDropzone";
import { ProjectsGridSkeleton } from "@/components/ui/page-skeleton";

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: "Ativo",     className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  paused:    { label: "Pausado",   className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  completed: { label: "Concluído", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  archived:  { label: "Arquivado", className: "bg-muted text-muted-foreground border-border" },
};

const PROJECT_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#0EA5E9"];

function progressBarColor(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-blue-500";
  if (percent >= 20) return "bg-amber-500";
  return "bg-red-500";
}

function NewProjectDialog({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [parentId, setParentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado!");
      setOpen(false);
      setTitle(""); setEmoji(""); setParentId(null);
    },
    onError: () => toast.error("Erro ao criar projeto"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Novo Projeto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex gap-3">
            <Input placeholder="🎯" value={emoji} onChange={(e) => setEmoji(e.target.value)}
              className="w-20 text-center text-lg" maxLength={2} />
            <Input placeholder="Nome do projeto" value={title} onChange={(e) => setTitle(e.target.value)}
              className="flex-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Projeto pai (opcional)</Label>
            <Select
              value={parentId ?? "none"}
              onValueChange={(v) => setParentId(v === "none" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Nenhum (projeto raiz)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (projeto raiz)</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji ? `${p.emoji} ` : ""}{p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Button
            onClick={() => mutation.mutate({
              title: title.trim() || "Sem título", emoji, cover_color: color, parent_id: parentId,
            })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar Projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const statusCfg = STATUS_CONFIG[node.status] ?? STATUS_CONFIG.active;

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
          depth === 1 && "border-l-violet-500/50",
          depth === 2 && "border-l-blue-500/50",
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
                <div className={cn("h-full", progressBarColor(node.progressPercent))}
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Projetos</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {projects.length} projeto{projects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>

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
