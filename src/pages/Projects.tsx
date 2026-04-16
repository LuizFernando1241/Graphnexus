import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { fetchProjects, createProject } from "@/lib/api/projects";
import { fetchLinkedTaskStats } from "@/lib/api/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Project, ProjectStatus } from "@/types/entities";
import { PageTransition } from "@/components/PageTransition";
import { ProjectsGridSkeleton } from "@/components/ui/page-skeleton";

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "#10B981",
  paused: "#F59E0B",
  completed: "#3B82F6",
  archived: "#6B7280",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  completed: "Completo",
  archived: "Arquivado",
};

const PROJECT_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#0EA5E9"];

function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado!");
      setOpen(false);
      setTitle("");
      setEmoji("");
    },
    onError: () => toast.error("Erro ao criar projeto"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Projeto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex gap-3">
            <Input
              placeholder="🎯"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-20 text-center text-lg"
              maxLength={2}
            />
            <Input
              placeholder="Nome do projeto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Cor</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={() => mutation.mutate({ title: title.trim() || "Sem título", emoji, cover_color: color })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar Projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const { data: stats } = useQuery({
    queryKey: ["project-task-stats", project.id],
    queryFn: () => fetchLinkedTaskStats(project.id),
  });

  const progress = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-lg border border-border overflow-hidden text-left transition-all duration-200 active:scale-[0.97] hover:bg-accent"
    >
      {/* Color header */}
      <div className="h-2" style={{ backgroundColor: project.cover_color || "#7C3AED" }} />
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {project.emoji && <span className="text-lg">{project.emoji}</span>}
          <h3 className="font-heading font-semibold text-foreground line-clamp-1">{project.title}</h3>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs"
            style={{ color: STATUS_COLORS[project.status] }}
          >
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {stats && stats.total > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground">{stats.done}/{stats.total}</span>
          </div>
        )}
      </div>
    </button>
  );
}

export default function Projects() {
  const navigate = useNavigate();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
  });

  if (isLoading) return <ProjectsGridSkeleton />;

  return (
    <PageTransition>
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projetos</h1>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <FolderKanban className="h-10 w-10" />
          <p>Nenhum projeto ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
