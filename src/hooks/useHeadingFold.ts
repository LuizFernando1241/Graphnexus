import { useEffect, useRef, type RefObject } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Obsidian-style hierarchical heading folding for a TipTap editor.
 *
 * Strategy (robust against ProseMirror re-rendering):
 *   1. We never write `style.display` or attributes to ProseMirror-owned nodes
 *      (it will strip / overwrite them on the next view update).
 *   2. Instead we generate a CSS rule that targets
 *        `.ProseMirror > :nth-child(N)`
 *      for the indices that should be hidden, and inject that rule into a
 *      `<style>` tag we own. The selector evaluates fresh on every paint, so
 *      it survives ProseMirror swapping individual child elements.
 *   3. Chevrons are rendered into an overlay div the caller provides, with
 *      absolute positioning computed from each heading's bounding rect.
 *   4. Collapsed headings are tracked by a content-derived key and persisted
 *      to localStorage per `storageKey` (e.g. `note:<id>`).
 */

function isHeadingTag(tag: string) {
  return /^H[1-6]$/.test(tag);
}

function levelFromTag(tag: string) {
  return parseInt(tag.substring(1), 10);
}

const STORAGE_PREFIX = "heading-fold:";

function loadCollapsedKeys(storageKey?: string): Set<string> {
  if (!storageKey || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v) => typeof v === "string"));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveCollapsedKeys(storageKey: string | undefined, keys: Set<string>) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + storageKey,
      JSON.stringify(Array.from(keys)),
    );
  } catch {
    /* ignore */
  }
}

let styleIdCounter = 0;

export function useHeadingFold(
  editor: Editor | null,
  overlayRef: RefObject<HTMLDivElement>,
  storageKey?: string,
) {
  const collapsedKeysRef = useRef<Set<string>>(new Set());
  const frameRef = useRef<number | null>(null);
  const styleElRef = useRef<HTMLStyleElement | null>(null);
  const instanceIdRef = useRef<string>(`fold-${++styleIdCounter}`);

  useEffect(() => {
    if (!editor) return;

    collapsedKeysRef.current = loadCollapsedKeys(storageKey);

    const root = editor.view.dom as HTMLElement;
    const overlay = overlayRef.current;
    if (!root || !overlay) return;

    // Tag the root with a unique attribute so our CSS only targets THIS editor.
    const instanceId = instanceIdRef.current;
    root.setAttribute("data-fold-instance", instanceId);

    // Inject a stylesheet we own. ProseMirror does not touch document-level
    // styles, so rules here always win.
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-fold-style", instanceId);
    document.head.appendChild(styleEl);
    styleElRef.current = styleEl;

    // Persist state under a stable key derived from the heading's tag + text.
    // The same heading text under the same tag at the same ordinal collapses.
    const headingKey = (tag: string, ordinal: number, text: string) =>
      `${tag}-${ordinal}-${text.trim().slice(0, 80)}`;

    const apply = () => {
      const children = Array.from(root.children) as HTMLElement[];
      const collapsedKeys = collapsedKeysRef.current;
      const hiddenIndices: number[] = [];

      // Track ordinal per tag so keys are stable across renders.
      const tagOrdinals = new Map<string, number>();

      // Pre-compute keys for headings.
      const headingInfo: Array<{
        index: number;
        level: number;
        key: string;
        el: HTMLElement;
      }> = [];

      children.forEach((el, index) => {
        const tag = el.tagName;
        if (!isHeadingTag(tag)) return;
        const ordinal = (tagOrdinals.get(tag) ?? 0);
        tagOrdinals.set(tag, ordinal + 1);
        const text = el.textContent ?? "";
        headingInfo.push({
          index,
          level: levelFromTag(tag),
          key: headingKey(tag, ordinal, text),
          el,
        });
      });

      // Determine which child indices must be hidden.
      // Also track which heading indices are themselves hidden (nested
      // under a collapsed ancestor) — we still render their chevron only if
      // visible.
      const hiddenIndexSet = new Set<number>();

      headingInfo.forEach((h) => {
        if (!collapsedKeys.has(h.key)) return;
        // Hide every sibling after this heading until we hit a heading of
        // equal or higher level (lower numeric value).
        for (let i = h.index + 1; i < children.length; i++) {
          const child = children[i];
          const tag = child.tagName;
          if (isHeadingTag(tag) && levelFromTag(tag) <= h.level) break;
          hiddenIndexSet.add(i);
        }
      });

      hiddenIndexSet.forEach((i) => hiddenIndices.push(i));
      hiddenIndices.sort((a, b) => a - b);

      // Write the stylesheet. nth-child is 1-based.
      const selector = `[data-fold-instance="${instanceId}"]`;
      if (hiddenIndices.length === 0) {
        styleEl.textContent = "";
      } else {
        const rules = hiddenIndices
          .map((i) => `${selector} > :nth-child(${i + 1})`)
          .join(",\n");
        styleEl.textContent = `${rules} { display: none !important; }`;
      }

      // Render chevrons (overlay).
      overlay.innerHTML = "";
      const overlayRect = overlay.getBoundingClientRect();

      // Place the chevron inside the editor's left gutter, in a fixed column
      // aligned with where the heading text starts.
      const rootRect = root.getBoundingClientRect();
      const rootStyles = window.getComputedStyle(root);
      const gutterPx = parseFloat(rootStyles.paddingLeft || "0") || 24;
      const chevronColumn = rootRect.left - overlayRect.left + gutterPx / 2;

      headingInfo.forEach((h) => {
        if (hiddenIndexSet.has(h.index)) return; // heading itself is hidden
        const rect = h.el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const isCollapsed = collapsedKeys.has(h.key);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "heading-fold-toggle";
        button.dataset.folded = isCollapsed ? "true" : "false";
        button.setAttribute(
          "aria-label",
          isCollapsed ? "Expandir seção" : "Recolher seção",
        );
        // Vertically center on the first line of the heading (line-height aware).
        const headingStyles = window.getComputedStyle(h.el);
        const lineHeight = parseFloat(headingStyles.lineHeight) ||
          parseFloat(headingStyles.fontSize) * 1.3;
        button.style.top = `${rect.top - overlayRect.top + lineHeight / 2}px`;
        button.style.left = `${chevronColumn}px`;
        button.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

        // Prevent ProseMirror from stealing focus / changing selection.
        button.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (collapsedKeys.has(h.key)) {
            collapsedKeys.delete(h.key);
          } else {
            collapsedKeys.add(h.key);
          }
          saveCollapsedKeys(storageKey, collapsedKeys);
          apply();
        });

        overlay.appendChild(button);
      });
    };

    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        apply();
      });
    };

    // Initial pass.
    schedule();

    // React to editor doc changes.
    editor.on("update", schedule);
    editor.on("selectionUpdate", schedule);

    // Reposition overlay on viewport / size changes.
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);

    // ProseMirror swaps DOM children on edits — re-run when that happens.
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, subtree: false });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      editor.off("update", schedule);
      editor.off("selectionUpdate", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      overlay.innerHTML = "";
      if (styleElRef.current) {
        styleElRef.current.remove();
        styleElRef.current = null;
      }
      root.removeAttribute("data-fold-instance");
    };
  }, [editor, overlayRef, storageKey]);
}
