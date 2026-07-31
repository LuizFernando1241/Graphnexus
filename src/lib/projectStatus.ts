import type { ProjectStatus } from "@/types/entities";

/**
 * Configuração unificada de status de projeto usando tokens semânticos do design system.
 * Fonte única de verdade para cores de status em todo o projeto.
 */
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-success/15 text-success border-success/30" },
  paused: { label: "Pausado", className: "bg-warning/15 text-warning border-warning/30" },
  completed: { label: "Concluído", className: "bg-info/15 text-info border-info/30" },
  archived: { label: "Arquivado", className: "bg-muted text-muted-foreground border-border" },
};

/**
 * Retorna a classe de cor para barra de progresso baseada na porcentagem.
 * Usa tokens semânticos do design system.
 */
export function getProgressBarColor(percent: number): string {
  if (percent >= 80) return "bg-success";
  if (percent >= 50) return "bg-info";
  if (percent >= 20) return "bg-warning";
  return "bg-destructive";
}
