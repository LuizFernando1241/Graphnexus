import { Crosshair, Clock, Hourglass, CheckCircle2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import type { RadarProduto, PipelineStage, DecisaoFinal } from "@/types/radar";

interface KanbanBoardProps {
  produtos: RadarProduto[];
  onEdit: (produto: RadarProduto) => void;
  onHistorico: (produto: RadarProduto) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  decisionFilter: "todos" | "aprovado" | "reprovado";
  onChangeDecisionFilter: (v: "todos" | "aprovado" | "reprovado") => void;
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
}: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUNAS.map((col) => {
        let produtosDaColuna = produtos.filter((p) => p.stage === col.stage);

        if (col.stage === "decisao" && decisionFilter !== "todos") {
          produtosDaColuna = produtosDaColuna.filter(
            (p) => p.decisaoFinal === (decisionFilter as DecisaoFinal),
          );
        }

        produtosDaColuna = produtosDaColuna.sort(
          (a, b) => b.scoreTotal - a.scoreTotal,
        );

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
          />
        );
      })}
    </div>
  );
}
