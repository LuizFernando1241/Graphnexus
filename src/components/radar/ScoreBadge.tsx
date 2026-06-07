import { cn } from "@/lib/utils";
import type { DecisionBadge } from "@/types/radar";

interface ScoreBadgeProps {
  decision: DecisionBadge;
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<DecisionBadge, { label: string; className: string }> = {
  descarte: {
    label: "❌ Descarte",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
  },
  cautela: {
    label: "⚠️ Cautela",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900",
  },
  viavel: {
    label: "✅ Viável",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900",
  },
  excelente: {
    label: "🚀 Excelente",
    className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-900",
  },
};

export function ScoreBadge({ decision, size = "md", className }: ScoreBadgeProps) {
  const config = CONFIG[decision];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
