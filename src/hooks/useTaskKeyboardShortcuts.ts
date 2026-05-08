import { useEffect } from "react";

interface ShortcutHandlers {
  onQuickAdd?: () => void;
  onShowHelp?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useTaskKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "q" || e.key === "Q" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        handlers.onQuickAdd?.();
      } else if (e.key === "?") {
        e.preventDefault();
        handlers.onShowHelp?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
