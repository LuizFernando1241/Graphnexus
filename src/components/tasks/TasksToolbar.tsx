import { Search, X, SlidersHorizontal, Rows3, Rows2, ArrowUpDown, Calendar, Inbox, KanbanSquare, ListChecks, Layers } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TaskView, TaskDensity, TaskSort, TaskFilters } from "@/hooks/useTasksView";
import type { TaskPriority } from "@/types/entities";

const VIEWS: { id: TaskView; label: string; short: string; icon: typeof Calendar }[] = [
  { id: "today", label: "Hoje", short: "Hoje", icon: ListChecks },
  { id: "upcoming", label: "Próximos 7 dias", short: "Próx.", icon: Calendar },
  { id: "inbox", label: "Inbox", short: "Inbox", icon: Inbox },
  { id: "board", label: "Board", short: "Board", icon: KanbanSquare },
  { id: "all", label: "Todas", short: "Todas", icon: Layers },
];

const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: "urgent", label: "Urgente" },
  { id: "high", label: "Alta" },
  { id: "medium", label: "Média" },
  { id: "low", label: "Baixa" },
  { id: "none", label: "Sem prioridade" },
];

interface Props {
  view: TaskView;
  setView: (v: TaskView) => void;
  density: TaskDensity;
  setDensity: (d: TaskDensity) => void;
  sort: TaskSort;
  setSort: (s: TaskSort) => void;
  filters: TaskFilters;
  setFilters: (f: Partial<TaskFilters>) => void;
  activeFilterCount: number;
  totalCount: number;
}

export function TasksToolbar({
  view,
  setView,
  density,
  setDensity,
  sort,
  setSort,
  filters,
  setFilters,
  activeFilterCount,
  totalCount,
}: Props) {
  const isMobile = useIsMobile();

  const togglePrio = (p: TaskPriority) => {
    const next = filters.priority.includes(p)
      ? filters.priority.filter((x) => x !== p)
      : [...filters.priority, p];
    setFilters({ priority: next });
  };

  return (
    <div className="flex flex-col gap-2 sticky top-0 z-20 bg-background/95 backdrop-blur pt-1 pb-2 -mx-4 px-4 border-b border-border">
      {/* Row 1: view switcher + counter */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <div className="flex rounded-lg bg-secondary p-1 shrink-0">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{isMobile ? v.short : v.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 ml-1">
          {totalCount} {totalCount === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>

      {/* Row 2: search + filters + sort + density */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Buscar tarefas..."
            className="h-9 pl-8 pr-8"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 relative">
              <SlidersHorizontal className="h-4 w-4" />
              {!isMobile && "Filtros"}
              {activeFilterCount > 0 && (
                <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Prioridade</DropdownMenuLabel>
            {PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.id}
                checked={filters.priority.includes(p.id)}
                onCheckedChange={() => togglePrio(p.id)}
                onSelect={(e) => e.preventDefault()}
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={filters.recurringOnly}
              onCheckedChange={(v) => setFilters({ recurringOnly: !!v })}
              onSelect={(e) => e.preventDefault()}
            >
              Apenas recorrentes
            </DropdownMenuCheckboxItem>
            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  onClick={() => setFilters({ priority: [], recurringOnly: false })}
                  className="w-full text-left text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground"
                >
                  Limpar filtros
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <ArrowUpDown className="h-4 w-4" />
              {!isMobile && "Ordenar"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as TaskSort)}>
              <DropdownMenuRadioItem value="manual">Padrão</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="due">Por data</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="priority">Por prioridade</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created">Mais recentes</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="title">Título (A→Z)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Density (desktop only) */}
        {!isMobile && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
            aria-label="Alternar densidade"
            title={density === "comfortable" ? "Modo compacto" : "Modo confortável"}
          >
            {density === "comfortable" ? <Rows3 className="h-4 w-4" /> : <Rows2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
