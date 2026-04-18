import { useEffect } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Adds Obsidian-style hierarchical folding to headings inside a TipTap editor.
 *
 * For every <h1>-<h6> rendered by ProseMirror, injects a chevron toggle button.
 * Clicking it folds (visually hides) all sibling nodes that come AFTER the heading
 * until the next heading of equal or higher level is reached. Nested headings
 * (deeper level) are folded together with their parent, matching Obsidian behavior.
 *
 * The folding is purely visual (CSS via `data-folded-by`). The HTML content saved
 * to the database is not modified.
 */
export function useHeadingFold(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;

    const root = editor.view.dom as HTMLElement;
    if (!root) return;

    // Track collapsed state by heading text+level signature so it survives re-renders.
    const collapsedKeys = new Set<string>();

    const headingKey = (h: HTMLElement, index: number) =>
      `${h.tagName}-${index}-${h.textContent?.slice(0, 60) ?? ""}`;

    const applyFolding = () => {
      const headings = Array.from(
        root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
      );

      // Reset previous fold markers
      root
        .querySelectorAll<HTMLElement>("[data-folded-by]")
        .forEach((el) => el.removeAttribute("data-folded-by"));

      headings.forEach((heading, index) => {
        // Make sure each heading has a chevron button
        ensureChevron(heading);

        const key = headingKey(heading, index);
        const isCollapsed = collapsedKeys.has(key);
        heading.dataset.folded = isCollapsed ? "true" : "false";

        if (!isCollapsed) return;

        const level = parseInt(heading.tagName.substring(1), 10);
        let sibling = heading.nextElementSibling as HTMLElement | null;

        while (sibling) {
          // Stop when reaching a heading of equal or higher importance
          if (/^H[1-6]$/.test(sibling.tagName)) {
            const sibLevel = parseInt(sibling.tagName.substring(1), 10);
            if (sibLevel <= level) break;
          }
          sibling.dataset.foldedBy = key;
          sibling = sibling.nextElementSibling as HTMLElement | null;
        }
      });
    };

    const ensureChevron = (heading: HTMLElement) => {
      if (heading.querySelector(":scope > .heading-fold-toggle")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.contentEditable = "false";
      btn.className = "heading-fold-toggle";
      btn.setAttribute("aria-label", "Recolher seção");
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

      btn.addEventListener("mousedown", (e) => {
        // Prevent ProseMirror from stealing focus / moving caret
        e.preventDefault();
        e.stopPropagation();
      });

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Determine current index of this heading at click time (DOM may have changed)
        const all = Array.from(
          root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
        );
        const idx = all.indexOf(heading);
        if (idx === -1) return;
        const key = headingKey(heading, idx);
        if (collapsedKeys.has(key)) {
          collapsedKeys.delete(key);
        } else {
          collapsedKeys.add(key);
        }
        applyFolding();
      });

      // Insert chevron as first child so it sits before the heading text.
      heading.insertBefore(btn, heading.firstChild);
    };

    // Initial pass
    applyFolding();

    // Re-apply whenever the editor content changes
    const onUpdate = () => applyFolding();
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);

    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
    };
  }, [editor]);
}
