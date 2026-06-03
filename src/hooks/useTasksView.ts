import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocalStorage } from "./useLocalStorage";
import type { TaskPriority } from "@/types/entities";

export type TaskView = "today" | "upcoming" | "inbox" | "board" | "all";
export type TaskDensity = "comfortable" | "compact";
export type TaskSort = "manual" | "due" | "priority" | "created" | "title";

export interface TaskFilters {
  priority: TaskPriority[];
  recurringOnly: boolean;
  search: string;
}

const DEFAULT_FILTERS: TaskFilters = {
  priority: [],
  recurringOnly: false,
  search: "",
};

export function useTasksView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [storedView, setStoredView] = useLocalStorage<TaskView>("ui:tasks-view", "today");
  const [density, setDensity] = useLocalStorage<TaskDensity>("ui:tasks-density", "comfortable");
  const [sort, setSort] = useLocalStorage<TaskSort>("ui:tasks-sort", "created");
  const [filters, setFiltersStored] = useLocalStorage<TaskFilters>("ui:tasks-filters", DEFAULT_FILTERS);

  const view = (searchParams.get("view") as TaskView) || storedView;

  const setView = useCallback(
    (v: TaskView) => {
      const next = new URLSearchParams(searchParams);
      next.set("view", v);
      setSearchParams(next, { replace: true });
      setStoredView(v);
    },
    [searchParams, setSearchParams, setStoredView],
  );

  const setFilters = useCallback(
    (updater: Partial<TaskFilters> | ((prev: TaskFilters) => TaskFilters)) => {
      const next =
        typeof updater === "function" ? updater(filters) : { ...filters, ...updater };
      setFiltersStored(next);
    },
    [filters, setFiltersStored],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.priority.length) n += filters.priority.length;
    if (filters.recurringOnly) n += 1;
    return n;
  }, [filters]);

  return {
    view,
    setView,
    density,
    setDensity,
    sort,
    setSort,
    filters,
    setFilters,
    activeFilterCount,
  };
}
