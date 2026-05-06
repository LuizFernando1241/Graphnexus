import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Calendar, Flag, Repeat, ArrowLeftRight, Search, Plus, X } from "lucide-react";
import { format, isToday, isPast, isWithinInterval, addDays, startOfDay } from "date-fns";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Task, TaskStatus, TaskPriority } from "@/types/entities";

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  in_progress: { label: "Em Progresso", color: "#F59E0B" },
  todo: { label: "A Fazer", color: "#3B82F6" },
  backlog: { label: "Backlog", color: "#6B7280" },
  done: { label: "Concluído", color: "#10B981" },
  cancelled: { label: "Cancelado", color: "#6B7280" },
};

const STATUS_ORDER: TaskStatus[] = ["in_progress", "todo", "backlog", "done"];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: "#6B7280",
  low: "#3B82F6",
  medium: "#F59E0B",
  high: "#F97316",
  urgent: "#EF4444",
};

type Filter = "today" | "upcoming" | "all";

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveClick: (task: Task) => void;
  onNewTask: () => void;
}

export function TasksMobileList({ tasks, onTaskClick, onMoveClick, onNewTask }: Props) {
  const [filter, setFilter] = useState<Filter>("today");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage<Record<string, boolean>>(
    "ui:tasks-mobile-groups",
    { in_progress: false, todo: false, backlog: true, done: true },
  );

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const in7 = addDays(today, 7);
    let list = tasks.filter((t) => t.status !== "cancelled");

    if (filter === "today") {
      list = list.filter((t) => {
        if (t.status === "in_progress") return true;
        if (t.status === "done") return false;
        if (!t.due_date) return false;
        const d = new Date(t.due_date + "T00:00:00");
        return isToday(d) || isPast(d);
      });
    } else if (filter === "upcoming") {
      list = list.filter((t) => {
        if (t.status === "done") return false;
        if (!t.due_date) return false;
        const d = new Date(t.due_date + "T00:00:00");
        return isWithinInterval(d, { start: today, end: in7 });
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }

    return list;
  }, [tasks, filter, search]);

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = {
      backlog: [], todo: [], in_progress: [], done: [], cancelled: [],
    };
    filtered.forEach((t) => g[t.status]?.push(t));
    return g;
  }, [filtered]);

  const toggle = (status: TaskStatus) =>
    setCollapsed({ ...collapsed, [status]: !collapsed[status] });

  return (
    <div className="flex flex-col gap-3 h-full pb-20">
      {/* Sticky header: filtros + busca */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 pt-1 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 rounded-lg bg-secondary p-1">
            {([
              { id: "today", label: "Hoje" },
              { id: "upcoming", label: "Próximas" },
              { id: "all", label: "Todas" },
            ] as { id: Filter; label: string }[]).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                  filter === f.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearch("");
            }}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-secondary text-muted-foreground"
            aria-label="Buscar tarefas"
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
        {searchOpen && (
          <Input
            autoFocus
            placeholder="Buscar tarefa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 h-9"
          />
        )}
      </div>

      {/* Lista agrupada */}
      <div className="flex flex-col gap-1">
        {STATUS_ORDER.map((status) => {
          const items = grouped[status];
          if (items.length === 0) return null;
          const meta = STATUS_META[status];
          const isCollapsed = collapsed[status];
          return (
            <section key={status} className="flex flex-col">
              <button
                onClick={() => toggle(status)}
                aria-expanded={!isCollapsed}
                className="flex items-center gap-2 py-2 px-1 text-left min-h-[44px]"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-2 pl-1">
                  {items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                      onMoveClick={() => onMoveClick(task)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma tarefa para mostrar.
          </p>
        )}
      </div>

      {/* FAB */}
      <Button
        onClick={onNewTask}
        size="icon"
        aria-label="Nova tarefa"
        className="fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

function TaskRow({
  task,
  onClick,
  onMoveClick,
}: {
  task: Task;
  onClick: () => void;
  onMoveClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 active:bg-accent transition-colors min-h-[56px]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        {(task.priority !== "none" || task.due_date || task.recurrence_rule) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                {task.due_time && ` ${task.due_time}`}
              </span>
            )}
            {task.recurrence_rule && <Repeat className="h-3 w-3 text-primary" />}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveClick();
        }}
        className="flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:bg-accent shrink-0"
        aria-label="Mover tarefa"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </button>
    </div>
  );
}
