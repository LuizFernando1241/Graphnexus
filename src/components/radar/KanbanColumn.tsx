import { AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { ProdutoCard } from "./ProdutoCard";
import { cn } from "@/lib/utils";
import type { RadarProduto, PipelineStage } from "@/types/radar";

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
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {produtos.length}
          </span>
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
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : opt.v === "reprovado"
                        ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
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

      <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
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
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
