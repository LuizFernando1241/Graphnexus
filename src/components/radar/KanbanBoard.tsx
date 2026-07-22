import { Crosshair, Clock, Hourglass, CheckCircle2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import type { RadarProduto, PipelineStage, DecisaoFinal, ColumnSortConfigs, SortField, SortDirection } from "@/types/radar";

interface KanbanBoardProps {
  produtos: RadarProduto[];
  onEdit: (produto: RadarProduto) => void;
  onHistorico: (produto: RadarProduto) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  decisionFilter: "todos" | "aprovado" | "reprovado";
  onChangeDecisionFilter: (v: "todos" | "aprovado" | "reprovado") => void;
  columnSorts: ColumnSortConfigs;
  onSortChange: (stage: PipelineStage, field: SortField, direction: SortDirection) => void;
  onSortClear: (stage: PipelineStage) => void;
}

type ColunaCfg = {
  stage: PipelineStage;
  label: string;
  accentColor: string;
  emptyMessage: string;
  icon: React.ReactNode;
};

const COLUNAS: ColunaCfg[] = [
  {
    stage: "prospeccao",
    label: "Prospecção",
    accentColor: "bg-blue-400",
    emptyMessage: "Nenhum produto em avaliação. Clique em + Novo Produto.",
    icon: <Crosshair className="h-6 w-6" />,
  },
  {
    stage: "aguardando_custo",
    label: "Aguardando Custo",
    accentColor: "bg-amber-400",
    emptyMessage: "Produtos Viáveis ou Excelentes aparecem aqui após enviar para negociação.",
    icon: <Clock className="h-6 w-6" />,
  },
  {
    stage: "aguardando_decisao",
    label: "Aguardando Decisão",
    accentColor: "bg-violet-400",
    emptyMessage: "Produtos com custo registrado aparecem aqui aguardando sua decisão.",
    icon: <Hourglass className="h-6 w-6" />,
  },
  {
    stage: "decisao",
    label: "Decisão",
    accentColor: "bg-emerald-400",
    emptyMessage: "Aprove ou reprove produtos na coluna anterior.",
    icon: <CheckCircle2 className="h-6 w-6" />,
  },
];

export function KanbanBoard({
  produtos,
  onEdit,
  onHistorico,
  expandedIds,
  onToggleExpand,
  decisionFilter,
  onChangeDecisionFilter,
  columnSorts,
  onSortChange,
  onSortClear,
}: KanbanBoardProps) {
  // Função de ordenação baseada no campo e direção
  function sortProducts(products: RadarProduto[], field: SortField, direction: SortDirection) {
    return [...products].sort((a, b) => {
      let comparison = 0;

      switch (field) {
        case "scoreTotal":
          comparison = a.scoreTotal - b.scoreTotal;
          break;
        case "margem":
          comparison = (a.margem ?? 0) - (b.margem ?? 0);
          break;
        case "precoVenda":
          comparison = (a.precoVenda ?? 0) - (b.precoVenda ?? 0);
          break;
        case "vendasMes":
          comparison = (a.vendasMes ?? 0) - (b.vendasMes ?? 0);
          break;
        case "visitasMes":
          comparison = (a.visitasMes ?? 0) - (b.visitasMes ?? 0);
          break;
        case "stageEnteredAt":
          comparison = new Date(a.stageEnteredAt).getTime() - new Date(b.stageEnteredAt).getTime();
          break;
        default:
          comparison = 0;
      }

      return direction === "asc" ? comparison : -comparison;
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUNAS.map((col) => {
        let produtosDaColuna = produtos.filter((p) => p.stage === col.stage);

        if (col.stage === "decisao" && decisionFilter !== "todos") {
          produtosDaColuna = produtosDaColuna.filter(
            (p) => p.decisaoFinal === (decisionFilter as DecisaoFinal),
          );
        }

        // Aplicar ordenação personalizada se existir, senão ordenar por score (padrão)
        const sortConfig = columnSorts[col.stage];
        if (sortConfig) {
          produtosDaColuna = sortProducts(produtosDaColuna, sortConfig.field, sortConfig.direction);
        } else {
          produtosDaColuna = produtosDaColuna.sort((a, b) => b.scoreTotal - a.scoreTotal);
        }

        return (
          <KanbanColumn
            key={col.stage}
            stage={col.stage}
            label={col.label}
            produtos={produtosDaColuna}
            accentColor={col.accentColor}
            emptyMessage={col.emptyMessage}
            emptyIcon={col.icon}
            onEdit={onEdit}
            onHistorico={onHistorico}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            decisionFilter={col.stage === "decisao" ? decisionFilter : undefined}
            onChangeDecisionFilter={
              col.stage === "decisao" ? onChangeDecisionFilter : undefined
            }
            sortConfig={sortConfig ?? null}
            onSortChange={(field, direction) => onSortChange(col.stage, field, direction)}
            onSortClear={() => onSortClear(col.stage)}
          />
        );
      })}
    </div>
  );
}
