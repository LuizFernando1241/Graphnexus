import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { useCompleteRecurringTask } from "@/hooks/useRecurrence";
import { updateTask } from "@/lib/api/tasks";
import { TaskRow } from "../TaskRow";
import type { Task, TaskStatus } from "@/types/entities";
import type { TaskDensity } from "@/hooks/useTasksView";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "#6B7280" },
  { id: "todo", label: "A Fazer", color: "#3B82F6" },
  { id: "in_progress", label: "Em Progresso", color: "#F59E0B" },
  { id: "done", label: "Concluído", color: "#10B981" },
];

interface Props {
  tasks: Task[];
  density: TaskDensity;
  onMoveClick: (t: Task) => void;
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border border-border bg-secondary/40 p-3 min-h-[200px] min-w-[260px] snap-center shrink-0 md:min-w-0 md:shrink transition-colors ${
        isOver ? "bg-accent/50 border-primary/50" : ""
      }`}
    >
      {children}
    </div>
  );
}

function Draggable({ task, children }: { task: Task; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export function BoardView({ tasks, density, onMoveClick }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeRecurring = useCompleteRecurringTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const moveMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      updateTask(taskId, { status: newStatus, manualStatusChange: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === e.active.id) || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    if (!e.over) return;
    const taskId = e.active.id as string;
    const newStatus = e.over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    if (newStatus === "done") completeRecurring.mutate(task);
    else moveMutation.mutate({ taskId, newStatus });
  };

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none">
        {COLUMNS.map((col) => {
          const items = byStatus(col.id);
          return (
            <DroppableColumn key={col.id} id={col.id}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((task) => (
                  <Draggable key={task.id} task={task}>
                    <TaskRow
                      task={task}
                      density={density}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      onComplete={() =>
                        task.status === "done"
                          ? moveMutation.mutate({ taskId: task.id, newStatus: "todo" })
                          : completeRecurring.mutate(task)
                      }
                      onMoveClick={() => onMoveClick(task)}
                    />
                  </Draggable>
                ))}
              </div>
            </DroppableColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="w-64 opacity-80">
            <TaskRow task={activeTask} density={density} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
