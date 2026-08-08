import * as React from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface FloatingWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  className?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function FloatingWindow({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  defaultWidth = 720,
  defaultHeight = 640,
  minWidth = 340,
  minHeight = 240,
  className,
}: FloatingWindowProps) {
  const isMobile = useIsMobile();
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [maximized, setMaximized] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const restoreRef = React.useRef<Rect | null>(null);
  const dragRef = React.useRef<{ mode: "move" | "resize"; startX: number; startY: number; base: Rect } | null>(null);

  // Posição inicial centralizada ao abrir
  React.useEffect(() => {
    if (!open) return;
    setRect((prev) => {
      if (prev) return prev;
      const w = Math.min(defaultWidth, window.innerWidth - 32);
      const h = Math.min(defaultHeight, window.innerHeight - 32);
      return {
        w,
        h,
        x: Math.max(16, (window.innerWidth - w) / 2),
        y: Math.max(16, (window.innerHeight - h) / 2),
      };
    });
  }, [open, defaultWidth, defaultHeight]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const onPointerMove = React.useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setRect(() => {
      const base = drag.base;
      if (drag.mode === "move") {
        return {
          ...base,
          x: clamp(base.x + dx, -base.w + 120, window.innerWidth - 120),
          y: clamp(base.y + dy, 0, window.innerHeight - 48),
        };
      }
      return {
        ...base,
        w: clamp(base.w + dx, minWidth, window.innerWidth - 16),
        h: clamp(base.h + dy, minHeight, window.innerHeight - 16),
      };
    });
  }, [minWidth, minHeight]);

  const endDrag = React.useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    document.body.style.userSelect = "";
  }, [onPointerMove]);

  function startDrag(mode: "move" | "resize", e: React.PointerEvent) {
    if (!rect || maximized || isMobile) return;
    e.preventDefault();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, base: rect };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  }

  React.useEffect(() => endDrag, [endDrag]);

  if (!open || !rect) return null;

  const fullscreen = maximized || isMobile;

  const style: React.CSSProperties = fullscreen
    ? { left: 0, top: 0, width: "100vw", height: "100dvh" }
    : { left: rect.x, top: rect.y, width: rect.w, height: minimized ? undefined : rect.h };

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-label={typeof title === "string" ? title : undefined}
      style={style}
      className={cn(
        "fixed z-[80] flex flex-col rounded-lg border border-border bg-background shadow-2xl overflow-hidden",
        className,
      )}
    >
      <div
        onPointerDown={(e) => startDrag("move", e)}
        onDoubleClick={() => !isMobile && setMaximized((v) => !v)}
        className={cn(
          "flex items-start gap-2 border-b border-border bg-muted/40 px-4 py-3 shrink-0",
          !fullscreen && "cursor-move",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{title}</div>
          {description && !minimized && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            aria-label={minimized ? "Restaurar" : "Minimizar"}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMinimized(false);
              setMaximized((v) => {
                if (!v) restoreRef.current = rect;
                else if (restoreRef.current) setRect(restoreRef.current);
                return !v;
              });
            }}
            aria-label={maximized ? "Restaurar tamanho" : "Maximizar"}
            hidden={isMobile}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border px-4 py-3 shrink-0">
              {footer}
            </div>
          )}
          {!fullscreen && (
            <div
              onPointerDown={(e) => startDrag("resize", e)}
              aria-hidden
              className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
              style={{
                background:
                  "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%, hsl(var(--border)) 65%, transparent 65%, transparent 80%, hsl(var(--border)) 80%)",
              }}
            />
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
