import { useEffect, useRef, type RefObject } from "react";
import type { Editor } from "@tiptap/react";

function isHeadingElement(element: Element): element is HTMLElement {
  return /^H[1-6]$/.test(element.tagName);
}

function getHeadingLevel(element: Element): number {
  return parseInt(element.tagName.substring(1), 10);
}

/**
 * Adds Obsidian-style hierarchical folding to headings inside a TipTap editor.
 *
 * IMPORTANT: ProseMirror owns the editor DOM and can strip arbitrary attributes/classes
 * written onto managed nodes. Because of that, folding is applied by directly toggling
 * `style.display` on top-level sibling blocks instead of relying on custom attributes.
 */
export function useHeadingFold(
  editor: Editor | null,
  overlayRef: RefObject<HTMLDivElement>,
) {
  const collapsedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!editor) return;

    const root = editor.view.dom as HTMLElement;
    const overlay = overlayRef.current;
    if (!root || !overlay) return;

    const getTopLevelChildren = () => Array.from(root.children) as HTMLElement[];

    const getTopLevelHeadings = () =>
      getTopLevelChildren().filter((element): element is HTMLElement => isHeadingElement(element));

    const headingKey = (heading: HTMLElement, index: number) =>
      `${heading.tagName}-${index}-${(heading.textContent ?? "").trim().slice(0, 80)}`;

    const resetVisibility = () => {
      getTopLevelChildren().forEach((element) => {
        element.style.removeProperty("display");
      });
    };

    const applyFolding = () => {
      const headings = getTopLevelHeadings();
      const collapsedKeys = collapsedKeysRef.current;

      resetVisibility();
      overlay.innerHTML = "";

      const hiddenElements = new Set<HTMLElement>();

      // First pass: decide which top-level blocks should be hidden.
      headings.forEach((heading, index) => {
        const key = headingKey(heading, index);
        if (!collapsedKeys.has(key)) return;

        const level = getHeadingLevel(heading);
        let sibling = heading.nextElementSibling;

        while (sibling instanceof HTMLElement) {
          if (isHeadingElement(sibling) && getHeadingLevel(sibling) <= level) {
            break;
          }

          hiddenElements.add(sibling);
          sibling = sibling.nextElementSibling;
        }
      });

      hiddenElements.forEach((element) => {
        element.style.display = "none";
      });

      const overlayRect = overlay.getBoundingClientRect();

      // Second pass: render chevrons only for visible top-level headings.
      headings.forEach((heading, index) => {
        if (hiddenElements.has(heading)) return;

        const key = headingKey(heading, index);
        const isCollapsed = collapsedKeys.has(key);
        const rect = heading.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "heading-fold-toggle";
        button.dataset.folded = isCollapsed ? "true" : "false";
        button.setAttribute(
          "aria-label",
          isCollapsed ? "Expandir seção" : "Recolher seção",
        );
        button.style.top = `${rect.top - overlayRect.top + rect.height / 2}px`;
        button.style.left = `${rect.left - overlayRect.left}px`;
        button.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (collapsedKeys.has(key)) {
            collapsedKeys.delete(key);
          } else {
            collapsedKeys.add(key);
          }

          applyFolding();
        });

        overlay.appendChild(button);
      });
    };

    const schedule = () => requestAnimationFrame(applyFolding);

    schedule();

    editor.on("update", schedule);
    editor.on("selectionUpdate", schedule);
    window.addEventListener("resize", schedule);

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);

    return () => {
      editor.off("update", schedule);
      editor.off("selectionUpdate", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver.disconnect();
      overlay.innerHTML = "";
      resetVisibility();
    };
  }, [editor, overlayRef]);
}
