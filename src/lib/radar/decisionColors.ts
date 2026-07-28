import type { DecisionBadge } from "@/types/radar";
import type { PipelineStage } from "@/types/radar";

/**
 * Fonte única de verdade das cores de score/decisão do Radar.
 * Todas consomem os tokens `--score-*` definidos em index.css.
 */
export const DECISION_SOLID: Record<DecisionBadge, string> = {
  descarte: "bg-score-descarte",
  cautela: "bg-score-cautela",
  viavel: "bg-score-viavel",
  excelente: "bg-score-excelente",
};

export const DECISION_TEXT: Record<DecisionBadge, string> = {
  descarte: "text-score-descarte",
  cautela: "text-score-cautela",
  viavel: "text-score-viavel",
  excelente: "text-score-excelente",
};

export const DECISION_SOFT: Record<DecisionBadge, string> = {
  descarte: "bg-score-descarte/15 text-score-descarte border-score-descarte/30",
  cautela: "bg-score-cautela/15 text-score-cautela border-score-cautela/30",
  viavel: "bg-score-viavel/15 text-score-viavel border-score-viavel/30",
  excelente: "bg-score-excelente/15 text-score-excelente border-score-excelente/30",
};

export const DECISION_LABEL: Record<DecisionBadge, string> = {
  descarte: "❌ Descarte",
  cautela: "⚠️ Cautela",
  viavel: "✅ Viável",
  excelente: "🚀 Excelente",
};

/** Cor de acento de cada etapa do pipeline (mesma paleta de tokens). */
export const STAGE_SOLID: Record<PipelineStage, string> = {
  prospeccao: "bg-info",
  aguardando_custo: "bg-score-cautela",
  aguardando_decisao: "bg-score-excelente",
  decisao: "bg-score-viavel",
  comprado: "bg-score-viavel",
  aprovado: "bg-score-viavel",
  arquivado: "bg-muted",
};

export const STAGE_CHIP_ACTIVE: Record<PipelineStage, string> = {
  prospeccao: "border-info/60 bg-info/10 text-foreground",
  aguardando_custo: "border-score-cautela/60 bg-score-cautela/10 text-foreground",
  aguardando_decisao: "border-score-excelente/60 bg-score-excelente/10 text-foreground",
  decisao: "border-score-viavel/60 bg-score-viavel/10 text-foreground",
  comprado: "border-score-viavel/60 bg-score-viavel/10 text-foreground",
  aprovado: "border-score-viavel/60 bg-score-viavel/10 text-foreground",
  arquivado: "border-border bg-muted text-foreground",
};
