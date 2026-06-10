import { Crosshair, Clock, CheckCircle2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import type { RadarProduto, PipelineStage } from "@/types/radar";

interface KanbanBoardProps {
  produtos: RadarProduto[];
  onEdit: (produto: RadarProduto) => void;
  onHistorico: (produto: RadarProduto) => void;
}

const COLUNAS: Array<{
  stage: PipelineStage;
  label: string;
  accentColor: string;
  emptyMessage: string;
  icon: React.ReactNode;
}> = [
  {
    stage: "prospeccao",
    label: "Prospecção",
    accentColor: "bg-blue-400",
    emptyMessage: "Nenhum produto em avaliação. Clique em + Novo Produto para começar.",
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
    stage: "decisao",
    label: "Decisão",
    accentColor: "bg-violet-400",
    emptyMessage: "Nenhuma decisão pendente.",
    icon: <CheckCircle2 className="h-6 w-6" />,
  },
];

export function KanbanBoard({ produtos, onEdit, onHistorico }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUNAS.map((col) => {
        const produtosDaColuna = produtos
          .filter((p) => p.stage === col.stage)
          .sort((a, b) => b.scoreTotal - a.scoreTotal);
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
          />
        );
      })}
    </div>
  );
}
