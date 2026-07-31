import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTasks } from "@/lib/api/tasks";
import { useTasksView } from "@/hooks/useTasksView";
import { useTaskKeyboardShortcuts } from "@/hooks/useTaskKeyboardShortcuts";
import { useDebouncedValue } from "@/lib/utils";
import { PageTransition } from "@/components/PageTransition";
import { PageHeader } from "@/components/PageHeader";
import { ImportDropzone } from "@/components/import/ImportDropzone";
import { TasksBoardSkeleton } from "@/components/ui/page-skeleton";
import { TasksToolbar } from "@/components/tasks/TasksToolbar";
import { ListView } from "@/components/tasks/views/ListView";
import { BoardView } from "@/components/tasks/views/BoardView";
import { MoveTaskDrawer } from "@/components/tasks/MoveTaskDrawer";
import type { QuickAddTaskRowHandle } from "@/components/tasks/QuickAddTaskRow";
import type { Task, TaskStatus } from "@/types/entities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTask } from "@/lib/api/tasks";
import { useCompleteRecurringTask } from "@/hooks/useRecurrence";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3, none: 4,
};

export default function Tasks() {
  const { view, setView, density, setDensity, sort, setSort, filters, setFilters, activeFilterCount } = useTasksView();
  const quickAddRef = useRef<QuickAddTaskRowHandle>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  const completeRecurring = useCompleteRecurringTask();

  const debouncedSearch = useDebouncedValue(filters.search);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", debouncedSearch],
    queryFn: () => fetchTasks({ search: debouncedSearch }),
  });

  useTaskKeyboardShortcuts({
    onQuickAdd: () => quickAddRef.current?.focus(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      updateTask(taskId, { status: newStatus, manualStatusChange: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  // Apply filters + sort (search is now server-side)
  const filteredTasks = useMemo(() => {
    let list = tasks;

    if (filters.priority.length > 0) {
      list = list.filter((t) => filters.priority.includes(t.priority));
    }
    if (filters.recurringOnly) {
      list = list.filter((t) => !!t.recurrence_rule);
    }

    if (sort !== "manual") {
      list = [...list].sort((a, b) => {
        if (sort === "due") {
          const ad = a.due_date || "9999-12-31";
          const bd = b.due_date || "9999-12-31";
          return ad.localeCompare(bd);
        }
        if (sort === "priority") {
          return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
        }
        if (sort === "created") {
          return (b.created_at || "").localeCompare(a.created_at || "");
        }
        if (sort === "title") {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
    }

    return list;
  }, [tasks, filters, sort]);

  if (isLoading) return <TasksBoardSkeleton />;

  return (
    <PageTransition>
      <ImportDropzone defaultType="task">
      <div className="flex flex-col gap-4 h-full pb-20">
        <PageHeader title="Tarefas" />

        <TasksToolbar
          view={view}
          setView={setView}
          density={density}
          setDensity={setDensity}
          sort={sort}
          setSort={setSort}
          filters={filters}
          setFilters={setFilters}
          activeFilterCount={activeFilterCount}
          totalCount={filteredTasks.length}
        />

        {view === "board" ? (
          <BoardView
            tasks={filteredTasks}
            density={density}
            onMoveClick={(t) => setMoveTask(t)}
          />
        ) : (
          <ListView
            tasks={filteredTasks}
            view={view}
            density={density}
            onMoveClick={(t) => setMoveTask(t)}
            quickAddRef={quickAddRef}
          />
        )}

        <MoveTaskDrawer
          open={!!moveTask}
          onOpenChange={(open) => !open && setMoveTask(null)}
          currentStatus={(moveTask?.status as TaskStatus) ?? "backlog"}
          onMove={(newStatus) => {
            if (moveTask) {
              if (newStatus === "done") completeRecurring.mutate(moveTask);
              else moveMutation.mutate({ taskId: moveTask.id, newStatus });
            }
            setMoveTask(null);
          }}
        />
      </div>
      </ImportDropzone>
    </PageTransition>
  );
}
