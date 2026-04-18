import { useEffect, type RefObject } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Adds Obsidian-style hierarchical folding to headings inside a TipTap editor.
 *
 * Strategy: instead of injecting buttons inside ProseMirror's managed DOM
 * (which it actively rewrites on every transaction and would strip), we render
 * the chevron toggles in a sibling overlay layer (`overlayRef`) and absolutely
 * position them next to each heading.
 *
 * Folding hides every following sibling element until the next heading of equal
 * or higher level, matching Obsidian's behavior. It is purely visual — the
 * stored HTML is untouched.
 */
export function useHeadingFold(
  editor: Editor | null,
  overlayRef: RefObject<HTMLDivElement>,
) {
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const overlay = overlayRef.current;
    if (!root || !overlay) return;

    // Persistent collapsed-state set keyed by heading position+level+text.
    const collapsedKeys = new Set<string>();

    const headingKey = (h: HTMLElement, index: number) =>
      `${h.tagName}-${index}-${(h.textContent ?? "").slice(0, 60)}`;

    const applyFolding = () => {
      const headings = Array.from(
        root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
      );

      // Reset previous fold state
      root
        .querySelectorAll<HTMLElement>("[data-folded-by]")
        .forEach((el) => el.removeAttribute("data-folded-by"));

      // Clear overlay (we'll re-render all chevrons)
      overlay.innerHTML = "";

      const containerRect = overlay.getBoundingClientRect();

      // First pass: compute folded-by mapping so we can skip chevrons
      // for headings that are themselves hidden under a parent fold.
      const foldedBy = new Map<HTMLElement, string>();
      headings.forEach((heading, index) => {
        const key = headingKey(heading, index);
        if (!collapsedKeys.has(key)) return;
        const level = parseInt(heading.tagName.substring(1), 10);
        let sibling = heading.nextElementSibling as HTMLElement | null;
        while (sibling) {
          if (/^H[1-6]$/.test(sibling.tagName)) {
            const sibLevel = parseInt(sibling.tagName.substring(1), 10);
            if (sibLevel <= level) break;
          }
          foldedBy.set(sibling, key);
          sibling.dataset.foldedBy = key;
          sibling = sibling.nextElementSibling as HTMLElement | null;
        }
      });

      // Second pass: render chevrons only for visible headings
      headings.forEach((heading, index) => {
        const key = headingKey(heading, index);
        const isCollapsed = collapsedKeys.has(key);
        heading.dataset.folded = isCollapsed ? "true" : "false";

        // Skip rendering chevron if this heading is hidden under a parent
        if (foldedBy.has(heading)) return;

        const rect = heading.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "heading-fold-toggle";
        btn.setAttribute(
          "aria-label",
          isCollapsed ? "Expandir seção" : "Recolher seção",
        );
        btn.dataset.folded = isCollapsed ? "true" : "false";
        btn.style.top = `${rect.top - containerRect.top + rect.height / 2}px`;
        btn.style.left = `${rect.left - containerRect.left}px`;
        btn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (collapsedKeys.has(key)) {
            collapsedKeys.delete(key);
          } else {
            collapsedKeys.add(key);
          }
          applyFolding();
        });
        overlay.appendChild(btn);
      });
    };

    // Run after layout settles
    const schedule = () => requestAnimationFrame(applyFolding);

    schedule();

    // Re-render on content changes, selection changes (caret may shift layout),
    // and viewport resize.
    editor.on("update", schedule);
    editor.on("selectionUpdate", schedule);
    window.addEventListener("resize", schedule);

    // Observe layout shifts inside the editor (e.g., images loading)
    const ro = new ResizeObserver(schedule);
    ro.observe(root);

    return () => {
      editor.off("update", schedule);
      editor.off("selectionUpdate", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      overlay.innerHTML = "";
    };
  }, [editor, overlayRef]);
}
