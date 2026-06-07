import { AnimatePresence } from "framer-motion";
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
}

export function KanbanColumn({
  label,
  produtos,
  accentColor,
  emptyMessage,
  emptyIcon,
  onEdit,
  onHistorico,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card/40 overflow-hidden min-h-[300px]">
      {/* Topo colorido */}
      <div className={cn("h-1 w-full", accentColor)} />

      {/* Header da coluna */}
      <div className="px-3 py-2.5 border-b border-border/60">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{produtos.length}</span>
        </div>
      </div>

      {/* Lista de cards */}
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
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
