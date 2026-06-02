import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { addDays, isPast, isToday, parseISO, startOfDay, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useCompleteRecurringTask } from "@/hooks/useRecurrence";
import { updateTask } from "@/lib/api/tasks";
import { TaskRow } from "../TaskRow";
import { QuickAddTaskRow, type QuickAddTaskRowHandle } from "../QuickAddTaskRow";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/entities";
import type { TaskDensity, TaskView } from "@/hooks/useTasksView";

interface Group {
  id: string;
  label: string;
  emphasis?: "danger" | "warning" | "default";
  tasks: Task[];
}

interface Props {
  tasks: Task[];
  view: TaskView;
  density: TaskDensity;
  onMoveClick: (t: Task) => void;
  quickAddRef?: React.RefObject<QuickAddTaskRowHandle>;
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3, none: 4,
};

function buildGroups(view: TaskView, tasks: Task[]): Group[] {
  const today = startOfDay(new Date());

  if (view === "today") {
    const overdue = tasks.filter((t) => {
      if (t.status === "done") return false;
      if (!t.due_date) return false;
      const d = parseISO(t.due_date + "T00:00:00");
      return isPast(d) && !isToday(d);
    });
    const todayTasks = tasks.filter((t) => {
      if (t.status === "done") return false;
      if (t.status === "in_progress") return true;
      if (!t.due_date) return false;
      return isToday(parseISO(t.due_date + "T00:00:00"));
    }).filter((t) => !overdue.includes(t));

    const groups: Group[] = [];
    if (overdue.length) groups.push({ id: "overdue", label: "Atrasadas", emphasis: "danger", tasks: overdue });
    groups.push({ id: "today", label: "Hoje", emphasis: "warning", tasks: todayTasks });
    return groups;
  }

  if (view === "upcoming") {
    const groups: Group[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(today, i);
      const items = tasks.filter((t) => {
        if (t.status === "done") return false;
        if (!t.due_date) return false;
        return isSameDay(parseISO(t.due_date + "T00:00:00"), day);
      });
      const label =
        i === 0 ? "Hoje" :
        i === 1 ? "Amanhã" :
        format(day, "EEEE · dd MMM", { locale: ptBR });
      groups.push({ id: `day-${i}`, label: label.charAt(0).toUpperCase() + label.slice(1), tasks: items });
    }
    const later = tasks.filter((t) => {
      if (t.status === "done") return false;
      if (!t.due_date) return false;
      const d = parseISO(t.due_date + "T00:00:00");
      return d > addDays(today, 6);
    });
    if (later.length) groups.push({ id: "later", label: "Mais tarde", tasks: later });
    return groups;
  }

  if (view === "inbox") {
    const inbox = tasks.filter((t) => t.status === "backlog" && !t.due_date);
    return [{ id: "inbox", label: "Inbox", tasks: inbox }];
  }

  // all
  const grouped: Record<string, Task[]> = {
    in_progress: [], todo: [], backlog: [], done: [],
  };
  tasks.forEach((t) => {
    if (grouped[t.status]) grouped[t.status].push(t);
  });
  return [
    { id: "in_progress", label: "Em Progresso", tasks: grouped.in_progress },
    { id: "todo", label: "A Fazer", tasks: grouped.todo },
    { id: "backlog", label: "Backlog", tasks: grouped.backlog },
    { id: "done", label: "Concluído", tasks: grouped.done },
  ];
}

export function ListView({ tasks, view, density, onMoveClick, quickAddRef }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeRecurring = useCompleteRecurringTask();
  const [collapsed, setCollapsed] = useLocalStorage<Record<string, boolean>>(
    `ui:tasks-list-collapsed:${view}`,
    {},
  );

  const moveMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: any }) =>
      updateTask(taskId, { status: newStatus, manualStatusChange: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const groups = useMemo(() => buildGroups(view, tasks), [view, tasks]);

  const toggle = (id: string) => setCollapsed({ ...collapsed, [id]: !collapsed[id] });

  // Defaults for QuickAdd based on view
  const quickAddDefaults = useMemo(() => {
    if (view === "today") return { defaultStatus: "todo", defaultDueDate: format(new Date(), "yyyy-MM-dd") };
    if (view === "inbox") return { defaultStatus: "backlog", defaultDueDate: null };
    return {};
  }, [view]);

  const totalShown = groups.reduce((s, g) => s + g.tasks.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <QuickAddTaskRow ref={quickAddRef} {...quickAddDefaults} />

      {totalShown === 0 ? (
        <EmptyState view={view} />
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map((g) => {
            if (g.tasks.length === 0 && view !== "upcoming") return null;
            const isCollapsed = collapsed[g.id];
            return (
              <section key={g.id} className="flex flex-col">
                <button
                  onClick={() => toggle(g.id)}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-2 py-2 px-1 text-left min-h-[40px]"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h2
                    className={cn(
                      "text-sm font-semibold",
                      g.emphasis === "danger" ? "text-destructive" :
                      g.emphasis === "warning" ? "text-warning" :
                      "text-foreground",
                    )}
                  >
                    {g.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">{g.tasks.length}</span>
                </button>
                {!isCollapsed && g.tasks.length > 0 && (
                  <div className="flex flex-col gap-1.5 pl-1">
                    <AnimatePresence initial={false}>
                      {g.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
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
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                {!isCollapsed && g.tasks.length === 0 && view === "upcoming" && (
                  <p className="pl-6 text-xs text-muted-foreground/70 pb-1">—</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ view }: { view: TaskView }) {
  const messages: Record<TaskView, { title: string; sub: string }> = {
    today: { title: "Tudo limpo para hoje 🎉", sub: "Você zerou suas tarefas de hoje." },
    upcoming: { title: "Nenhuma tarefa próxima", sub: "Os próximos 7 dias estão livres." },
    inbox: { title: "Inbox zerada ✨", sub: "Capture novas ideias usando o campo acima." },
    board: { title: "Sem tarefas no board", sub: "" },
    all: { title: "Nenhuma tarefa", sub: "Crie sua primeira tarefa acima." },
  };
  const m = messages[view];
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <Sparkles className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-semibold text-foreground">{m.title}</p>
      {m.sub && <p className="text-sm text-muted-foreground">{m.sub}</p>}
    </div>
  );
}
