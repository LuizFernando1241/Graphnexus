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
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setAcoesVisiveis(true)}
      onMouseLeave={() => setAcoesVisiveis(false)}
    >
      <Card
        className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
        onClick={() => onEdit(produto)}
      >
        <CardContent className="p-3 flex flex-col gap-2.5">
          {/* Nome + Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                {produto.nome}
              </h3>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{produto.fornecedor}</span>
              </div>
            </div>
            <ScoreBadge decision={produto.decision} size="sm" />
          </div>

          {/* Barra de score */}
          <ScoreBar score={produto.scoreTotal} decision={produto.decision} />

          {/* Preço + faturamento */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex flex-col gap-0.5 min-w-0">
              {produto.precoVenda != null && (
                <span className="font-semibold text-foreground">
                  {formatCurrency(produto.precoVenda)}
                </span>
              )}
              {faturamentoEstimado != null && (
                <span className="text-muted-foreground">
                  {formatCurrency(faturamentoEstimado)}/mês
                </span>
              )}
            </div>
            {produto.linkML && (
              <a
                href={produto.linkML}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                title="Abrir no Mercado Livre"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Pilares + data + histórico */}
          <div className="flex items-center justify-between gap-2">
            <PilarDots produto={produto} />
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="truncate">{dataRelativa}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHistorico(produto);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Ver histórico"
              >
                <History className="h-3 w-3" />
              </button>
            </div>
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
            <div className="pt-1.5 border-t border-border/50">
              <AcoesPorEtapa
                produto={produto}
                onMover={handleMover}
                onEdit={() => onEdit(produto)}
                isLoading={isMovendo}
              />
            </div>
          </motion.div>
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
