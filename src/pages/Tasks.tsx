import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { Plus, GripVertical, Calendar, Flag, Repeat, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchTasks, updateTask, createTask } from "@/lib/api/tasks";
import { useCompleteRecurringTask } from "@/hooks/useRecurrence";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageTransition } from "@/components/PageTransition";
import { TasksBoardSkeleton } from "@/components/ui/page-skeleton";
import { MoveTaskDrawer } from "@/components/tasks/MoveTaskDrawer";
import { TasksMobileList } from "@/components/tasks/TasksMobileList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Task, TaskStatus, TaskPriority } from "@/types/entities";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "#6B7280" },
  { id: "todo", label: "A Fazer", color: "#3B82F6" },
  { id: "in_progress", label: "Em Progresso", color: "#F59E0B" },
  { id: "done", label: "Concluído", color: "#10B981" },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "#6B7280",
  low: "#3B82F6",
  medium: "#F59E0B",
  high: "#F97316",
  urgent: "#EF4444",
};

function TaskCard({
  task,
  onClick,
  isDragging,
  onMoveClick,
}: {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
  onMoveClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-2 rounded-lg border border-border bg-card p-3 cursor-pointer transition-colors hover:bg-accent ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab hidden md:block" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {task.priority !== "none" && (
            <span className="flex items-center gap-1">
              <Flag className="h-3 w-3" style={{ color: PRIORITY_COLORS[task.priority] }} />
              <span className="text-xs text-muted-foreground capitalize">{task.priority}</span>
            </span>
          )}
          {task.due_date && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date + "T00:00:00"), "dd/MM")}
            </span>
          )}
          {task.recurrence_rule && (
            <Repeat className="h-3 w-3 text-primary" />
          )}
        </div>
      </div>
      {/* Mobile-only move button */}
      {onMoveClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveClick(e);
          }}
          className="flex md:hidden items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent shrink-0 self-center"
          aria-label="Mover tarefa"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function NewTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada!");
      setOpen(false);
      setTitle("");
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <Input
            placeholder="Título da tarefa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                mutation.mutate({ title: title.trim() });
              }
            }}
          />
          <Button
            onClick={() => mutation.mutate({ title: title.trim() || "Sem título" })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border border-border bg-secondary/50 p-3 min-h-[200px] min-w-[260px] snap-center shrink-0 md:min-w-0 md:shrink transition-colors ${
        isOver ? "bg-accent/50 border-primary/50" : ""
      }`}
    >
      {children}
    </div>
  );
}

function DraggableTask({ task, onClick, onMoveClick }: { task: Task; onClick: () => void; onMoveClick: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCard task={task} onClick={onClick} onMoveClick={onMoveClick} />
    </div>
  );
}

export default function Tasks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeRecurring = useCompleteRecurringTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      updateTask(taskId, { status: newStatus, manualStatusChange: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === event.active.id) || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    if (newStatus === "done") {
      completeRecurring.mutate(task);
    } else {
      moveMutation.mutate({ taskId, newStatus });
    }
  };

  const handleMobileMove = (task: Task, newStatus: TaskStatus) => {
    if (newStatus === "done") {
      completeRecurring.mutate(task);
    } else {
      moveMutation.mutate({ taskId: task.id, newStatus });
    }
  };

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  if (isLoading) return <TasksBoardSkeleton />;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <NewTaskDialog />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-x-auto snap-x snap-mandatory pb-4 md:overflow-x-visible md:pb-0">
            {COLUMNS.map((col) => (
              <DroppableColumn key={col.id} id={col.id}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                  <span className="text-xs text-muted-foreground">({tasksByStatus(col.id).length})</span>
                </div>
                <div className="flex flex-col gap-2">
                  {tasksByStatus(col.id).map((task) => (
                    <DraggableTask
                      key={task.id}
                      task={task}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      onMoveClick={() => setMoveTask(task)}
                    />
                  ))}
                </div>
              </DroppableColumn>
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="w-64">
                <TaskCard task={activeTask} onClick={() => {}} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Mobile move drawer */}
        <MoveTaskDrawer
          open={!!moveTask}
          onOpenChange={(open) => !open && setMoveTask(null)}
          currentStatus={moveTask?.status as TaskStatus ?? "backlog"}
          onMove={(newStatus) => {
            if (moveTask) handleMobileMove(moveTask, newStatus);
            setMoveTask(null);
          }}
        />
      </div>
    </PageTransition>
  );
}
