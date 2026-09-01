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
  bodyClassName?: string;
  /** Se informado, posição/tamanho são lembrados entre sessões. */
  storageKey?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

interface SavedRect extends Rect {
  maximized?: boolean;
}

function orientation() {
  return window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
}

/** Chave separada por dispositivo e orientação: cada contexto lembra o seu layout. */
function savedKey(storageKey: string, isMobile: boolean) {
  return `fw:${storageKey}:${isMobile ? "m" : "d"}:${orientation()}`;
}

function readSaved(storageKey: string, isMobile: boolean): SavedRect | null {
  try {
    const raw = localStorage.getItem(savedKey(storageKey, isMobile));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.w === "number" && typeof p?.h === "number" && typeof p?.x === "number" && typeof p?.y === "number") {
      return p as SavedRect;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeSaved(storageKey: string, isMobile: boolean, value: SavedRect) {
  try {
    localStorage.setItem(savedKey(storageKey, isMobile), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Garante que o retângulo salvo cabe na viewport atual. */
function fitRect(r: Rect, minWidth: number, minHeight: number): Rect {
  const w = clamp(r.w, Math.min(minWidth, window.innerWidth - 16), Math.max(120, window.innerWidth - 16));
  const h = clamp(r.h, Math.min(minHeight, window.innerHeight - 16), Math.max(120, window.innerHeight - 16));
  return {
    w,
    h,
    x: clamp(r.x, 8, Math.max(8, window.innerWidth - w - 8)),
    y: clamp(r.y, 8, Math.max(8, window.innerHeight - h - 8)),
  };
}


/* ------------------------------------------------------------------ */
/* Gerenciador global de janelas (empilhamento + barra de minimizados) */
/* ------------------------------------------------------------------ */

const BASE_Z = 80;
const MAX_Z = 95; // mantém as janelas SEMPRE abaixo dos overlays Radix (z-[100]+)
let zCounter = BASE_Z;

interface WinEntry {
  id: string;
  z: number;
  minimized: boolean;
  close: () => void;
}

const registry = new Map<string, WinEntry>();
const listeners = new Set<() => void>();
let snapshot: string[] = [];

function emit() {
  snapshot = Array.from(registry.values())
    .filter((w) => w.minimized)
    .map((w) => w.id);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getMinimizedIds() {
  return snapshot;
}

function nextZ() {
  zCounter += 1;
  if (zCounter > MAX_Z) {
    // renumera para nunca ultrapassar os overlays modais
    const sorted = Array.from(registry.values()).sort((a, b) => a.z - b.z);
    zCounter = BASE_Z;
    sorted.forEach((w) => {
      w.z = ++zCounter;
    });
    if (zCounter >= MAX_Z) zCounter = MAX_Z;
  }
  return zCounter;
}

function isTopmost(id: string) {
  const me = registry.get(id);
  if (!me || me.minimized) return false;
  for (const w of registry.values()) {
    if (!w.minimized && w.z > me.z) return false;
  }
  return true;
}


/** Evita fechar a janela quando um popover/select/tooltip do Radix está aberto. */
function hasOpenOverlay() {
  return (
    document.querySelector("[data-radix-popper-content-wrapper]") !== null ||
    document.querySelector("[role='dialog'][data-state='open']") !== null
  );
}

let uid = 0;

/* ------------------------------------------------------------------ */

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
  bodyClassName,
  storageKey,
}: FloatingWindowProps) {
  const isMobile = useIsMobile();
  const idRef = React.useRef<string>();
  if (!idRef.current) idRef.current = `fw-${++uid}`;
  const id = idRef.current;
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  const [rect, setRect] = React.useState<Rect | null>(null);
  const [maximized, setMaximized] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [z, setZ] = React.useState(BASE_Z);
  const restoreRef = React.useRef<Rect | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const openerRef = React.useRef<Element | null>(null);
  const dragRef = React.useRef<{
    mode: "move" | ResizeDir;
    startX: number;
    startY: number;
    base: Rect;
  } | null>(null);

  const minimizedIds = React.useSyncExternalStore(subscribe, getMinimizedIds, getMinimizedIds);
  const dockIndex = minimizedIds.indexOf(id);

  const bringToFront = React.useCallback(() => {
    const entry = registry.get(id);
    if (!entry) return;
    if (entry.z === zCounter) return;
    entry.z = ++zCounter;
    setZ(entry.z);
  }, [id]);

  /* ---- ciclo de vida: registro, posição inicial, reset ao fechar ---- */
  React.useEffect(() => {
    if (!open) {
      registry.delete(id);
      emit();
      // reset para que a próxima abertura releia o layout salvo
      setMinimized(false);
      setMaximized(false);
      setRect(null);
      const opener = openerRef.current as HTMLElement | null;
      openerRef.current = null;
      if (opener && document.contains(opener)) opener.focus?.();
      return;
    }

    openerRef.current = document.activeElement;

    const saved = storageKey ? readSaved(storageKey, isMobile) : null;
    if (saved) setMaximized(!!saved.maximized);
    else if (isMobile) setMaximized(true);

    setRect((prev) => {
      if (prev) return prev;
      if (saved) return fitRect(saved, minWidth, minHeight);
      const w = clamp(defaultWidth, minWidth, window.innerWidth - 32);
      const h = clamp(defaultHeight, minHeight, window.innerHeight - 32);
      const offset = registry.size * 24;
      return {
        w,
        h,
        x: clamp((window.innerWidth - w) / 2 + offset, 8, Math.max(8, window.innerWidth - w - 8)),
        y: clamp((window.innerHeight - h) / 2 + offset, 8, Math.max(8, window.innerHeight - h - 8)),
      };
    });


    const entry: WinEntry = { id, z: ++zCounter, minimized: false, close: () => onOpenChange(false) };
    registry.set(id, entry);
    setZ(entry.z);
    emit();

    return () => {
      registry.delete(id);
      emit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  // mantém o estado de minimizado sincronizado com a barra inferior
  React.useEffect(() => {
    const entry = registry.get(id);
    if (!entry) return;
    entry.minimized = minimized;
    emit();
  }, [minimized, id]);

  // mantém a referência de fechamento atualizada
  React.useEffect(() => {
    const entry = registry.get(id);
    if (entry) entry.close = () => onOpenChange(false);
  });

  /* ---- Esc fecha apenas a janela do topo ---- */
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (hasOpenOverlay()) return;
      if (!isTopmost(id)) return;
      e.stopPropagation();
      onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, id]);

  /* ---- foco inicial ---- */
  React.useEffect(() => {
    if (!open || minimized) return;
    const t = window.setTimeout(() => {
      const node = panelRef.current;
      if (!node || node.contains(document.activeElement)) return;
      const focusable = node.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable='true']",
      );
      (focusable ?? node).focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, minimized]);

  /* ---- persistência (por dispositivo + orientação) ---- */
  const persist = React.useCallback(
    (r: Rect, maxi = maximized) => {
      if (!storageKey) return;
      writeSaved(storageKey, isMobile, { ...r, maximized: maxi });
    },
    [storageKey, isMobile, maximized],
  );

  /* ---- redimensionamento / troca de orientação ---- */
  const orientRef = React.useRef(orientation());
  React.useEffect(() => {
    if (!open) return;
    function onResize() {
      const nextOrient = orientation();
      const changed = nextOrient !== orientRef.current;
      orientRef.current = nextOrient;

      if (changed && storageKey) {
        const saved = readSaved(storageKey, isMobile);
        if (saved) {
          setMaximized(!!saved.maximized);
          setRect(fitRect(saved, minWidth, minHeight));
          return;
        }
      }

      setRect((prev) => {
        if (!prev) return prev;
        const w = clamp(prev.w, minWidth, Math.max(minWidth, window.innerWidth - 16));
        const h = clamp(prev.h, minHeight, Math.max(minHeight, window.innerHeight - 16));
        const next = {
          w,
          h,
          x: clamp(prev.x, 8 - w + 120, Math.max(8, window.innerWidth - 120)),
          y: clamp(prev.y, 0, Math.max(0, window.innerHeight - 48)),
        };
        if (changed && storageKey) writeSaved(storageKey, isMobile, { ...next, maximized });
        return next;
      });
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [open, minWidth, minHeight, storageKey, isMobile, maximized]);


  /* ---- arrastar e redimensionar ---- */
  const onPointerMove = React.useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const base = drag.base;

      setRect(() => {
        if (drag.mode === "move") {
          return {
            ...base,
            x: clamp(base.x + dx, -base.w + 120, window.innerWidth - 120),
            y: clamp(base.y + dy, 0, window.innerHeight - 48),
          };
        }
        const dir = drag.mode;
        let { x, y, w, h } = base;
        const maxW = window.innerWidth - 16;
        const maxH = window.innerHeight - 16;

        if (dir.includes("e")) w = clamp(base.w + dx, minWidth, maxW - base.x);
        if (dir.includes("s")) h = clamp(base.h + dy, minHeight, maxH - base.y);
        if (dir.includes("w")) {
          w = clamp(base.w - dx, minWidth, base.x + base.w);
          x = base.x + base.w - w;
        }
        if (dir.includes("n")) {
          h = clamp(base.h - dy, minHeight, base.y + base.h);
          y = base.y + base.h - h;
        }
        return { x, y, w, h };
      });
    },
    [minWidth, minHeight],
  );

  const endDrag = React.useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      setRect((r) => {
        if (r) persist(r);
        return r;
      });
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    document.body.style.userSelect = "";
  }, [onPointerMove, persist]);

  React.useEffect(() => endDrag, [endDrag]);

  function startDrag(mode: "move" | ResizeDir, e: React.PointerEvent) {
    if (!rect || maximized || minimized) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    bringToFront();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, base: rect };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  function toggleMaximize() {
    setMinimized(false);
    setMaximized((v) => {
      const next = !v;
      if (next) {
        restoreRef.current = rect;
        if (rect) persist(rect, true);
      } else {
        const target = restoreRef.current ?? rect;
        if (target) {
          setRect(target);
          persist(target, false);
        }
      }
      return next;
    });
  }

  if (!open || !rect) return null;

  const fullscreen = maximized;


  /* ---- estado minimizado: barra compacta ancorada no rodapé ---- */
  if (minimized) {
    return createPortal(
      <div
        className="fixed bottom-3 z-[90] flex w-[min(280px,calc(100vw-24px))] items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
        style={{ left: 12 + Math.max(0, dockIndex) * (isMobile ? 0 : 292) }}
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:text-primary"
          title="Restaurar janela"
        >
          {title}
        </button>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Restaurar"
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Fechar"
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>,
      document.body,
    );
  }

  const style: React.CSSProperties = fullscreen
    ? { left: 0, top: 0, width: "100vw", height: "100dvh", zIndex: z }
    : { left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: z };

  const handles: { dir: ResizeDir; className: string }[] = [
    { dir: "n", className: "top-0 left-3 right-3 h-1.5 cursor-ns-resize" },
    { dir: "s", className: "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize" },
    { dir: "w", className: "left-0 top-3 bottom-3 w-1.5 cursor-ew-resize" },
    { dir: "e", className: "right-0 top-3 bottom-3 w-1.5 cursor-ew-resize" },
    { dir: "nw", className: "top-0 left-0 h-3 w-3 cursor-nwse-resize" },
    { dir: "ne", className: "top-0 right-0 h-3 w-3 cursor-nesw-resize" },
    { dir: "sw", className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" },
    { dir: "se", className: "bottom-0 right-0 h-4 w-4 cursor-nwse-resize" },
  ];

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      tabIndex={-1}
      style={style}
      onPointerDownCapture={bringToFront}
      onFocusCapture={bringToFront}
      className={cn(
        "fixed flex flex-col border border-border bg-background shadow-2xl outline-none",
        fullscreen ? "rounded-none" : "rounded-lg",
        className,
      )}
    >
      <div
        onPointerDown={(e) => startDrag("move", e)}
        onDoubleClick={toggleMaximize}
        className={cn(
          "flex items-start gap-2 rounded-t-lg border-b border-border bg-muted/40 px-4 py-3 shrink-0 touch-none select-none",
          !fullscreen && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="min-w-0 flex-1">
          <div id={titleId} className="text-sm font-semibold text-foreground truncate">
            {title}
          </div>
          {description && (
            <p id={descId} className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
        <div
          className="flex items-center gap-0.5 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimizar"
            title="Minimizar"
            className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleMaximize}
            aria-label={maximized ? "Restaurar tamanho" : "Maximizar"}
            title={maximized ? "Restaurar tamanho" : "Maximizar"}
            className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            title="Fechar (Esc)"
            className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4", bodyClassName)}>
        {children}
      </div>

      {footer && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border bg-background px-4 py-3 shrink-0">
          {footer}
        </div>
      )}

      {!fullscreen &&
        handles.map((h) => (
          <div
            key={h.dir}
            onPointerDown={(e) => startDrag(h.dir, e)}
            aria-hidden
            className={cn("absolute touch-none", h.className)}
          />
        ))}
      {!fullscreen && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-4 w-4"
          style={{
            background:
              "linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%, hsl(var(--border)) 65%, transparent 65%, transparent 80%, hsl(var(--border)) 80%)",
          }}
        />
      )}
    </div>,
    document.body,
  );
}
