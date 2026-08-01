import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { useState } from "react";
import { KanbanBoard } from "./KanbanBoard";
import { ProdutoCard } from "./ProdutoCard";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import type { RadarProduto, PipelineStage, ColumnSortConfigs, SortField, SortDirection } from "@/types/radar";

const STAGES_VALIDOS: PipelineStage[] = [
  "prospeccao",
  "aguardando_custo",
  "aguardando_decisao",
  "decisao",
  "arquivado",
];

interface KanbanDnDProps {
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
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

export function KanbanDnD({
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
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
}: KanbanDnDProps) {
  const { moverEtapa } = useRadarProdutos();
  const [activeProduto, setActiveProduto] = useState<RadarProduto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const produto = produtos.find((p) => p.id === event.active.id);
    if (produto) setActiveProduto(produto);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveProduto(null);
    const { active, over } = event;
    if (!over) return;

    const produtoId = String(active.id);
    const novaEtapa = String(over.id) as PipelineStage;

    if (!STAGES_VALIDOS.includes(novaEtapa)) return;

    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto || produto.stage === novaEtapa) return;

    await moverEtapa({ id: produtoId, novaEtapa, produtoAtual: produto });
  }

  return (
    <>
      {selectionMode ? (
        <KanbanBoard
          produtos={produtos}
          onEdit={onEdit}
          onHistorico={onHistorico}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          decisionFilter={decisionFilter}
          onChangeDecisionFilter={onChangeDecisionFilter}
          columnSorts={columnSorts}
          onSortChange={onSortChange}
          onSortClear={onSortClear}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelection={onToggleSelection}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveProduto(null)}
        >
          <KanbanBoard
            produtos={produtos}
            onEdit={onEdit}
            onHistorico={onHistorico}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            decisionFilter={decisionFilter}
            onChangeDecisionFilter={onChangeDecisionFilter}
            columnSorts={columnSorts}
            onSortChange={onSortChange}
            onSortClear={onSortClear}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
          />
          <DragOverlay>
            {activeProduto && (
              <div className="rotate-2 opacity-95">
                <ProdutoCard
                  produto={activeProduto}
                  onEdit={() => {}}
                  onHistorico={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
}
