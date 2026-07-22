import { motion, AnimatePresence } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, ExternalLink, History, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScoreBadge } from "./ScoreBadge";
import { PilarDots } from "./PilarDots";
import { formatCurrency } from "@/lib/radar/radarScore";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { cn } from "@/lib/utils";
import type { RadarProduto, PipelineStage, DecisaoFinal } from "@/types/radar";

interface ProdutoCardProps {
  produto: RadarProduto;
  onEdit: (produto: RadarProduto) => void;
  onHistorico: (produto: RadarProduto) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function ProdutoCard({
  produto,
  onEdit,
  onHistorico,
  expanded = false,
  onToggleExpand,
}: ProdutoCardProps) {
  const { moverEtapa, isMovendo } = useRadarProdutos();

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: produto.id });

  const dragStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const faturamentoEstimado =
    produto.vendasMes != null && produto.precoVenda != null
      ? produto.vendasMes * produto.precoVenda
      : null;

  const dataRelativa = formatDistanceToNow(new Date(produto.stageEnteredAt), {
    addSuffix: true,
    locale: ptBR,
  });

  async function handleMover(
    novaEtapa: PipelineStage,
    motivo?: string,
    decisaoFinal?: DecisaoFinal | null,
  ) {
    await moverEtapa({
      id: produto.id,
      novaEtapa,
      motivo,
      produtoAtual: produto,
      decisaoFinal: decisaoFinal ?? undefined,
    });
  }

  // Cor da faixa lateral: em Decisão usa cor do decisao_final; senão usa decision score.
  const stripeColor =
    produto.stage === "decisao" && produto.decisaoFinal
      ? produto.decisaoFinal === "aprovado"
        ? "bg-emerald-500"
        : "bg-rose-500"
      : produto.decision === "excelente"
        ? "bg-emerald-500"
        : produto.decision === "viavel"
          ? "bg-blue-500"
          : produto.decision === "cautela"
            ? "bg-amber-500"
            : "bg-rose-500";

  return (
    <motion.div
      ref={setNodeRef}
      style={dragStyle}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(isDragging ? "opacity-40 cursor-grabbing" : "cursor-grab")}
    >
      <Card
        className="hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
        title={produto.nome}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch gap-2">
            <div className={cn("w-1 shrink-0", stripeColor)} />
            <div className="flex flex-col gap-2 py-2 pr-3 min-w-0 flex-1">
              {/* Linha 1 */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand?.();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="shrink-0 text-muted-foreground hover:text-foreground rounded"
                  title={expanded ? "Recolher" : "Expandir"}
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
                <h3
                  className="text-sm font-semibold text-foreground truncate flex-1 leading-tight cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(produto);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {produto.nome}
                </h3>
                <span className="text-xs font-bold tabular-nums text-foreground shrink-0">
                  {produto.scoreTotal}
                </span>
                {produto.stage === "decisao" && produto.decisaoFinal ? (
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                      produto.decisaoFinal === "aprovado"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {produto.decisaoFinal === "aprovado" ? "APROV" : "REPR"}
                  </span>
                ) : (
                  <ScoreBadge decision={produto.decision} size="sm" />
                )}
              </div>

              {/* Linha 2 - Fornecedor e preço */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{produto.fornecedor}</span>
                {produto.precoVenda != null && (
                  <>
                    <span className="opacity-40 mx-1">·</span>
                    <span className="font-semibold text-foreground shrink-0">
                      {formatCurrency(produto.precoVenda)}
                    </span>
                  </>
                )}
                {faturamentoEstimado != null && (
                  <>
                    <span className="opacity-40 mx-1">·</span>
                    <span className="shrink-0 truncate">
                      {formatCurrency(faturamentoEstimado)}/mês
                    </span>
                  </>
                )}
              </div>

              {/* Linha 3 - Ações e metadados */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <PilarDots produto={produto} />
                <div className="flex items-center gap-2 ml-auto">
                  {produto.linkML && (
                    <a
                      href={produto.linkML}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      title="Abrir no Mercado Livre"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onHistorico(produto);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title={`Há ${dataRelativa} · Ver histórico`}
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Expansão: métricas + ações */}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="pt-1.5 mt-1 border-t border-border/50 space-y-1.5">
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                        <Metric
                          label="Margem"
                          value={
                            produto.margem != null
                              ? `${produto.margem.toFixed(1)}%`
                              : "—"
                          }
                        />
                        <Metric
                          label="Custo"
                          value={
                            produto.custo != null
                              ? formatCurrency(produto.custo)
                              : "—"
                          }
                        />
                        <Metric
                          label="Visitas/mês"
                          value={
                            produto.visitasMes != null
                              ? produto.visitasMes.toLocaleString("pt-BR")
                              : "—"
                          }
                        />
                        <Metric
                          label="Vendas/mês"
                          value={
                            produto.vendasMes != null
                              ? produto.vendasMes.toLocaleString("pt-BR")
                              : "—"
                          }
                        />
                        <Metric
                          label="Conc. FULL"
                          value={
                            produto.concorrentesFull != null
                              ? String(produto.concorrentesFull)
                              : "—"
                          }
                        />
                        <Metric
                          label="Lançamento"
                          value={produto.isLancamento ? "Sim" : "Não"}
                        />
                      </div>
                      {produto.observacoes && (
                        <p className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {produto.observacoes}
                        </p>
                      )}
                      {produto.decisaoMotivo && (
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium">Motivo:</span>{" "}
                          {produto.decisaoMotivo}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70">
                        Nesta etapa {dataRelativa}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ações contextuais (sempre visíveis) */}
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <AcoesPorEtapa
                  produto={produto}
                  onMover={handleMover}
                  onEdit={() => onEdit(produto)}
                  isLoading={isMovendo}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium tabular-nums truncate">
        {value}
      </span>
    </div>
  );
}

// ── Botões de ação por etapa ─────────────────────────────────────────────────

interface AcoesPorEtapaProps {
  produto: RadarProduto;
  onMover: (
    etapa: PipelineStage,
    motivo?: string,
    decisaoFinal?: DecisaoFinal | null,
  ) => void;
  onEdit: () => void;
  isLoading: boolean;
}

function AcoesPorEtapa({ produto, onMover, onEdit, isLoading }: AcoesPorEtapaProps) {
  const podeNegociar =
    produto.decision === "viavel" || produto.decision === "excelente";

  if (produto.stage === "prospeccao") {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        {podeNegociar ? (
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs flex-1"
            disabled={isLoading}
            onClick={() => onMover("aguardando_custo")}
          >
            Negociar →
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={onEdit}
          >
            Revisar dados
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={isLoading}
          onClick={() => onMover("arquivado")}
        >
          Arquivar
        </Button>
      </div>
    );
  }

  if (produto.stage === "aguardando_custo") {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1"
          disabled={isLoading}
          onClick={() => onMover("aguardando_decisao")}
        >
          Enviar p/ decisão →
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onEdit}
        >
          Editar
        </Button>
      </div>
    );
  }

  if (produto.stage === "aguardando_decisao") {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isLoading}
          onClick={() => onMover("decisao", undefined, "aprovado")}
        >
          ✅ Aprovar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1"
          disabled={isLoading}
          onClick={() => onMover("decisao", "Reprovado", "reprovado")}
        >
          ❌ Reprovar
        </Button>
      </div>
    );
  }

  if (produto.stage === "decisao") {
    if (produto.decisaoFinal === "aprovado") {
      return (
        <div className="flex items-center gap-1.5 mt-1">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs flex-1"
            disabled={isLoading}
            onClick={() => onMover("comprado")}
          >
            🛒 Comprar →
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => onMover("aguardando_decisao", undefined, null)}
          >
            Reabrir
          </Button>
        </div>
      );
    }
    if (produto.decisaoFinal === "reprovado") {
      return (
        <div className="flex items-center gap-1.5 mt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            disabled={isLoading}
            onClick={() => onMover("aguardando_decisao", undefined, null)}
          >
            ↩ Reabrir análise
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => onMover("arquivado")}
          >
            Arquivar
          </Button>
        </div>
      );
    }
    return null;
  }

  if (produto.stage === "arquivado") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs w-full mt-1"
        disabled={isLoading}
        onClick={() => onMover("prospeccao")}
      >
        ↩ Reabrir prospecção
      </Button>
    );
  }

  return null;
}
