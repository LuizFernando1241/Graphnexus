import { cn } from "@/lib/utils";
import { DECISION_SOFT, DECISION_LABEL } from "@/lib/radar/decisionColors";
import type { DecisionBadge } from "@/types/radar";

interface ScoreBadgeProps {
  decision: DecisionBadge;
  size?: "sm" | "md";
  className?: string;
}

export function ScoreBadge({ decision, size = "md", className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        DECISION_SOFT[decision],
        className,
      )}
    >
      {DECISION_LABEL[decision]}
    </span>
  );
}
