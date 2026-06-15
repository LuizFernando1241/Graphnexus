import { useState } from "react";
import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Clock, ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScoreBadge } from "./ScoreBadge";
import { ScoreBar } from "./ScoreBar";
import { PilarDots } from "./PilarDots";
import { formatCurrency } from "@/lib/radar/radarScore";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { cn } from "@/lib/utils";
import type { RadarProduto, PipelineStage } from "@/types/radar";


interface ProdutoCardProps {
  produto: RadarProduto;
  onEdit: (produto: RadarProduto) => void;
  onHistorico: (produto: RadarProduto) => void;
}

export function ProdutoCard({ produto, onEdit, onHistorico }: ProdutoCardProps) {
  const [acoesVisiveis, setAcoesVisiveis] = useState(false);
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

  async function handleMover(novaEtapa: PipelineStage, motivo?: string) {
    await moverEtapa({ id: produto.id, novaEtapa, motivo, produtoAtual: produto });
  }

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
      onMouseEnter={() => setAcoesVisiveis(true)}
      onMouseLeave={() => setAcoesVisiveis(false)}
      className={cn(isDragging ? "opacity-40 cursor-grabbing" : "cursor-grab")}
    >

      <Card
        className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
        onClick={() => onEdit(produto)}
        title={produto.nome}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch gap-2">
            {/* Faixa vertical de decisão */}
            <div
              className={cn(
                "w-1 shrink-0",
                produto.decision === "excelente" && "bg-emerald-500",
                produto.decision === "viavel" && "bg-blue-500",
                produto.decision === "cautela" && "bg-amber-500",
                produto.decision === "descarte" && "bg-rose-500",
              )}
            />
            <div className="flex flex-col gap-1 py-1.5 pr-2 min-w-0 flex-1">
              {/* Linha 1: título + score */}
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-[13px] font-semibold text-foreground truncate flex-1 leading-tight">
                  {produto.nome}
                </h3>
                <span className="text-xs font-bold tabular-nums text-foreground shrink-0">
                  {produto.scoreTotal}
                </span>
                <ScoreBadge decision={produto.decision} size="sm" />
              </div>

              {/* Linha 2: fornecedor · preço · faturamento · pilares · ações */}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-w-0">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{produto.fornecedor}</span>
                  {produto.precoVenda != null && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="font-semibold text-foreground shrink-0">
                        {formatCurrency(produto.precoVenda)}
                      </span>
                    </>
                  )}
                  {faturamentoEstimado != null && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="shrink-0 truncate">{formatCurrency(faturamentoEstimado)}/mês</span>
                    </>
                  )}
                </div>
                <PilarDots produto={produto} />
                {produto.linkML && (
                  <a
                    href={produto.linkML}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title="Abrir no Mercado Livre"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHistorico(produto);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title={`Há ${dataRelativa} · Ver histórico`}
                >
                  <History className="h-3 w-3" />
                </button>
              </div>

              {/* Ações no hover */}
              <motion.div
                initial={false}
                animate={{
                  opacity: acoesVisiveis ? 1 : 0,
                  height: acoesVisiveis ? "auto" : 0,
                }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pt-1 mt-0.5 border-t border-border/50">
                  <AcoesPorEtapa
                    produto={produto}
                    onMover={handleMover}
                    onEdit={() => onEdit(produto)}
                    isLoading={isMovendo}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Botões de ação contextual por etapa ──────────────────────────────────────

interface AcoesPorEtapaProps {
  produto: RadarProduto;
  onMover: (etapa: PipelineStage, motivo?: string) => void;
  onEdit: () => void;
  isLoading: boolean;
}

function AcoesPorEtapa({ produto, onMover, onEdit, isLoading }: AcoesPorEtapaProps) {
  const podeNegociar = produto.decision === "viavel" || produto.decision === "excelente";

  if (produto.stage === "prospeccao") {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
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
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onEdit}>
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
      <Button
        size="sm"
        variant="default"
        className="h-7 text-xs w-full mt-1.5"
        disabled={isLoading}
        onClick={onEdit}
      >
        Registrar custo e margem →
      </Button>
    );
  }

  if (produto.stage === "decisao") {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isLoading}
          onClick={() => onMover("aprovado")}
        >
          ✅ Comprar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1"
          disabled={isLoading}
          onClick={() => onMover("arquivado", "Não vai comprar")}
        >
          ❌ Recusar
        </Button>
      </div>
    );
  }

  if (produto.stage === "arquivado") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs w-full mt-1.5"
        disabled={isLoading}
        onClick={() => onMover("prospeccao")}
      >
        ↩ Reabrir prospecção
      </Button>
    );
  }

  return null;
}
