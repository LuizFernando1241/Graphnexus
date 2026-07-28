import { memo } from "react";
import { format, isPast, isToday, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Flag, Repeat, Clock, Check, ArrowLeftRight } from "lucide-react";
import { motion } from "framer-motion";
import { SwipeableItem } from "@/components/ui/SwipeableItem";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types/entities";
import type { TaskDensity } from "@/hooks/useTasksView";

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; border: string }> = {
  none: { label: "", color: "text-muted-foreground", border: "border-l-transparent" },
  low: { label: "Baixa", color: "text-info", border: "border-l-info" },
  medium: { label: "Média", color: "text-warning", border: "border-l-warning" },
  high: { label: "Alta", color: "text-orange-400", border: "border-l-orange-500" },
  urgent: { label: "Urgente", color: "text-destructive", border: "border-l-destructive" },
};

interface TaskRowProps {
  task: Task;
  density?: TaskDensity;
  selected?: boolean;
  onClick?: () => void;
  onComplete?: () => void;
  onMoveClick?: () => void;
  showProject?: boolean;
}

function formatDue(dueDate: string, dueTime: string | null) {
  const d = parseISO(dueDate + "T00:00:00");
  const today = startOfDay(new Date());
  const isOverdue = isPast(d) && !isToday(d);
  const isTodayDate = isToday(d);

  let label: string;
  if (isTodayDate) label = "Hoje";
  else if (d.getTime() === startOfDay(new Date(today.getTime() + 86400000)).getTime()) label = "Amanhã";
  else label = format(d, "dd MMM", { locale: ptBR });

  if (dueTime) label += ` ${dueTime.slice(0, 5)}`;

  return {
    label,
    cls: isOverdue
      ? "text-destructive"
      : isTodayDate
        ? "text-warning"
        : "text-muted-foreground",
  };
}

export const TaskRow = memo(function TaskRow({
  task,
  density = "comfortable",
  selected,
  onClick,
  onComplete,
  onMoveClick,
}: TaskRowProps) {
  const isMobile = useIsMobile();
  const compact = density === "compact";
  const isDone = task.status === "done";
  const prio = PRIORITY_META[task.priority];
  const due = task.due_date ? formatDue(task.due_date, task.due_time) : null;

  const content = (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border bg-card border-l-[3px] transition-colors cursor-pointer",
        prio.border,
        compact ? "px-3 py-2 min-h-[44px]" : "px-3 py-3 min-h-[56px]",
        selected && "ring-2 ring-primary",
        "hover:bg-accent/40 active:bg-accent/60",
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onComplete?.();
        }}
        aria-label={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
        className={cn(
          "mt-0.5 flex items-center justify-center shrink-0 rounded-full border-2 transition-all",
          compact ? "h-5 w-5" : "h-6 w-6",
          isDone
            ? "bg-success border-success"
            : "border-muted-foreground/40 hover:border-primary hover:bg-primary/10",
        )}
      >
        {isDone && <Check className="h-3.5 w-3.5 text-success-foreground" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isDone ? "line-through text-muted-foreground" : "text-foreground",
          )}
        >
          {task.title}
        </p>
        {!compact && (task.priority !== "none" || due || task.recurrence_rule) && (
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs">
            {task.priority !== "none" && (
              <span className={cn("flex items-center gap-1", prio.color)}>
                <Flag className="h-3 w-3" />
                {prio.label}
              </span>
            )}
            {due && (
              <span className={cn("flex items-center gap-1", due.cls)}>
                {task.due_time ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                {due.label}
              </span>
            )}
            {task.recurrence_rule && (
              <Repeat className="h-3 w-3 text-primary" />
            )}
          </div>
        )}
        {compact && due && (
          <span className={cn("text-xs", due.cls)}>{due.label}</span>
        )}
      </div>

      {/* Quick actions */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveClick?.();
        }}
        aria-label="Mover tarefa"
        className={cn(
          "shrink-0 flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-opacity",
          isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <ArrowLeftRight className="h-4 w-4" />
      </button>
    </div>
  );

  // On mobile, wrap with swipe gestures
  if (isMobile && onComplete) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.18 }}
      >
        <SwipeableItem
          onSwipeRight={onComplete}
          onSwipeLeft={onMoveClick}
          rightIcon={Check}
          leftIcon={ArrowLeftRight}
          rightBgColor="bg-success"
          leftBgColor="bg-primary"
        >
          {content}
        </SwipeableItem>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
    >
      {content}
    </motion.div>
  );
});
