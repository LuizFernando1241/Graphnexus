import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicButtonProps {
  listening: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function MicButton({ listening, onClick, disabled, className, size = "md" }: MicButtonProps) {
  const dim = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Parar ditado" : "Ditar por voz"}
      title={listening ? "Parar ditado" : "Ditar por voz"}
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-md border transition-colors",
        dim,
        listening
          ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
    >
      {listening ? <Square className={cn(icon, "fill-current")} /> : <Mic className={icon} />}
    </button>
  );
}
