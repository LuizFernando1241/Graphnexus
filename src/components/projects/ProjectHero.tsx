import { format } from "date-fns";
import { Calendar, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Project, ProjectStatus } from "@/types/entities";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  completed: "Completo",
  archived: "Arquivado",
};

const STATUS_VARIANT: Record<ProjectStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  completed: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  archived: "bg-muted text-muted-foreground border-border",
};

interface Props {
  project: Project;
  title: string;
  emoji: string;
  status: ProjectStatus;
  coverColor: string;
  startDate?: Date;
  targetDate?: Date;
  linkedTasksCount: number;
  onTitleChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
}

export function ProjectHero({
  project,
  title,
  emoji,
  status,
  coverColor,
  startDate,
  targetDate,
  linkedTasksCount,
  onTitleChange,
  onEmojiChange,
}: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      <div className="h-20 relative" style={{ background: `linear-gradient(135deg, ${coverColor} 0%, ${coverColor}cc 100%)` }}>
        <div className="absolute -bottom-8 left-6 h-16 w-16 rounded-2xl bg-background border-4 border-background shadow-md flex items-center justify-center">
          <Input
            value={emoji}
            onChange={(e) => onEmojiChange(e.target.value)}
            placeholder="🎯"
            className="w-full h-full text-center text-3xl bg-transparent border-none focus-visible:ring-0 p-0"
            maxLength={2}
            aria-label="Emoji do projeto"
          />
        </div>
      </div>
      <div className="pt-10 pb-5 px-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 min-w-[200px] text-2xl font-heading font-bold bg-transparent border-none focus-visible:ring-0 p-0 h-auto"
            placeholder="Nome do projeto"
            aria-label="Nome do projeto"
          />
          <Badge variant="outline" className={STATUS_VARIANT[status]}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
          {startDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(startDate, "dd/MM/yyyy")}
            </span>
          )}
          {targetDate && (
            <span className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              {format(targetDate, "dd/MM/yyyy")}
            </span>
          )}
          <span>{linkedTasksCount} tarefa{linkedTasksCount !== 1 ? "s" : ""} vinculada{linkedTasksCount !== 1 ? "s" : ""}</span>
          <span>Atualizado {format(new Date(project.updated_at), "dd/MM/yyyy")}</span>
        </div>
      </div>
    </div>
  );
}
