import { cn } from "@/lib/utils";
import type { DecisionBadge } from "@/types/radar";

interface ScoreBarProps {
  score: number;
  decision: DecisionBadge;
  showValue?: boolean;
  className?: string;
}

const BAR_COLOR: Record<DecisionBadge, string> = {
  descarte: "bg-red-500",
  cautela: "bg-amber-500",
  viavel: "bg-emerald-500",
  excelente: "bg-violet-500",
};

const MAX_SCORE_VISUAL = 50;

export function ScoreBar({ score, decision, showValue = true, className }: ScoreBarProps) {
  const percent = Math.min((score / MAX_SCORE_VISUAL) * 100, 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", BAR_COLOR[decision])}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue && (
        <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
          {score.toFixed(1)}
        </span>
      )}
    </div>
  );
}
