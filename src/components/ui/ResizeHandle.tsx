import { useEffect, useRef } from "react";

interface ResizeHandleProps {
  /** Side of the panel where the handle sits. "right" => drag right increases width. */
  side: "left" | "right";
  /** Current width in px. */
  width: number;
  /** Called with new width while dragging. */
  onChange: (next: number) => void;
  /** Called with final width on mouseup (after dragging finishes). */
  onCommit?: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Vertical resize handle (desktop-only via parent's `hidden md:flex` wrapper).
 * Renders a thin draggable strip with a visible affordance on hover/drag.
 */
export function ResizeHandle({
  side,
  width,
  onChange,
  min = 180,
  max = 600,
  className = "",
  ariaLabel = "Redimensionar painel",
}: ResizeHandleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next =
        side === "right"
          ? startWidthRef.current + delta
          : startWidthRef.current - delta;
      onChange(Math.max(min, Math.min(max, next)));
    };
    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [side, min, max, onChange]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      onMouseDown={(e) => {
        e.preventDefault();
        draggingRef.current = true;
        startXRef.current = e.clientX;
        startWidthRef.current = width;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 8;
        if (e.key === "ArrowLeft") {
          onChange(
            Math.max(min, Math.min(max, side === "right" ? width - step : width + step)),
          );
        } else if (e.key === "ArrowRight") {
          onChange(
            Math.max(min, Math.min(max, side === "right" ? width + step : width - step)),
          );
        }
      }}
      className={
        "group relative w-1.5 shrink-0 cursor-col-resize select-none " +
        "hover:bg-primary/20 active:bg-primary/30 transition-colors " +
        "focus-visible:outline-none focus-visible:bg-primary/30 " +
        className
      }
    >
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary/60 group-active:bg-primary transition-colors" />
    </div>
  );
}
