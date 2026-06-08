import { cn } from "@/lib/utils";
import { ScoreBadge } from "./ScoreBadge";
import { ScoreBar } from "./ScoreBar";
import type { ScoreResult, RadarWeights } from "@/types/radar";

interface ScorePainelProps {
  scoreResult: ScoreResult;
  className?: string;
}

const PILAR_LABELS: Record<keyof RadarWeights, string> = {
  margem: "Margem",
  ticket: "Ticket",
  demanda: "Demanda",
  visitas: "Visitas",
  concorrentes: "Conc.",
};

export function ScorePainel({ scoreResult, className }: ScorePainelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/40 p-4 flex flex-col gap-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Score
          </span>
          <span className="text-2xl font-bold font-mono tabular-nums">
            {scoreResult.scoreTotal.toFixed(1)}
          </span>
        </div>
        <ScoreBadge decision={scoreResult.decision} />
      </div>

      <ScoreBar
        score={scoreResult.scoreTotal}
        decision={scoreResult.decision}
        showValue={false}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {scoreResult.pilares.map((pilar) => (
          <div key={pilar.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                pilar.preenchido ? "bg-emerald-400" : "bg-muted-foreground/30",
              )}
            />
            <span className="text-[11px] text-muted-foreground">
              {PILAR_LABELS[pilar.key]}
            </span>
          </div>
        ))}
      </div>

      {scoreResult.alertas.length > 0 && (
        <div className="flex flex-col gap-1">
          {scoreResult.alertas.map((alerta, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400"
            >
              <span>⚠️</span>
              <span>{alerta}</span>
            </div>
          ))}
        </div>
      )}

      {scoreResult.descarteAutomatico && scoreResult.motivoDescarte && (
        <div className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <span>❌</span>
          <span>{scoreResult.motivoDescarte}</span>
        </div>
      )}
    </div>
  );
}
