import { AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { ProdutoCard } from "./ProdutoCard";
import { ColumnSortControl } from "./ColumnSortControl";
import { cn } from "@/lib/utils";
import type { RadarProduto, PipelineStage, ColumnSortConfig, SortField, SortDirection } from "@/types/radar";

interface KanbanColumnProps {
  stage: PipelineStage;
  label: string;
  produtos: RadarProduto[];
  accentColor: string;
  emptyMessage: string;
  emptyIcon: React.ReactNode;
  onEdit: (produto: RadarProduto) => void;
  onHistorico: (produto: RadarProduto) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  decisionFilter?: "todos" | "aprovado" | "reprovado";
  onChangeDecisionFilter?: (v: "todos" | "aprovado" | "reprovado") => void;
  sortConfig?: ColumnSortConfig | null;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
  onSortClear?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

export function KanbanColumn({
  stage,
  label,
  produtos,
  accentColor,
  emptyMessage,
  emptyIcon,
  onEdit,
  onHistorico,
  expandedIds,
  onToggleExpand,
  decisionFilter,
  onChangeDecisionFilter,
  sortConfig,
  onSortChange,
  onSortClear,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const showDecisionFilter = decisionFilter && onChangeDecisionFilter;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border bg-card/40 overflow-hidden min-w-0 min-h-[320px] md:h-[calc(100vh-220px)] transition-colors",
        isOver
          ? "border-primary/60 bg-primary/5 ring-2 ring-primary/30"
          : "border-border",
      )}
    >
      <div className={cn("h-1 w-full shrink-0", accentColor)} />

      <div className="sticky top-0 z-10 px-3 py-2 border-b border-border/60 bg-card/80 backdrop-blur shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          <div className="flex items-center gap-1">
            {onSortChange && onSortClear && (
              <ColumnSortControl
                sortConfig={sortConfig ?? null}
                onSortChange={onSortChange}
                onClear={onSortClear}
              />
            )}
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {produtos.length}
            </span>
          </div>
        </div>
        {showDecisionFilter && (
          <div className="mt-2 flex gap-1 rounded-md bg-muted/50 p-0.5 text-[11px]">
            {([
              { v: "todos", l: "Todos" },
              { v: "aprovado", l: "Aprov." },
              { v: "reprovado", l: "Repr." },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => onChangeDecisionFilter!(opt.v)}
                className={cn(
                  "flex-1 rounded px-1.5 py-0.5 transition-colors font-medium",
                  decisionFilter === opt.v
                    ? opt.v === "aprovado"
                      ? "bg-score-viavel/20 text-score-viavel"
                      : opt.v === "reprovado"
                        ? "bg-score-descarte/20 text-score-descarte"
                        : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-3">
              <div className="text-muted-foreground/60">{emptyIcon}</div>
              <p className="text-xs text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            produtos.map((produto) => (
              <ProdutoCard
                key={produto.id}
                produto={produto}
                onEdit={onEdit}
                onHistorico={onHistorico}
                expanded={expandedIds.has(produto.id)}
                onToggleExpand={() => onToggleExpand(produto.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(produto.id)}
                onToggleSelection={() => onToggleSelection?.(produto.id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
