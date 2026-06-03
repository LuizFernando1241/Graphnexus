import TurndownService from "turndown";
import { marked } from "marked";
import DOMPurify from "dompurify";

let _turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (_turndown) return _turndown;
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });

  // Tabelas (suporte básico via plugin manual)
  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content) => ` ${content.trim()} |`,
  });
  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content) => `|${content}\n`,
  });
  td.addRule("table", {
    filter: "table",
    replacement: (content) => `\n${content}\n`,
  });

  // Task list checkboxes (Tiptap renderiza como <li data-checked="true">)
  td.addRule("taskItem", {
    filter: (node) =>
      node.nodeName === "LI" &&
      (node.getAttribute("data-type") === "taskItem" || node.hasAttribute("data-checked")),
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      return `- [${checked ? "x" : " "}] ${content.trim()}\n`;
    },
  });

  _turndown = td;
  return td;
}

/**
 * Converte HTML (do Tiptap) para Markdown.
 */
export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return "";
  try {
    return getTurndown().turndown(html);
  } catch (err) {
    console.warn("htmlToMarkdown error:", err);
    return "";
  }
}

/**
 * Converte Markdown para HTML sanitizado, pronto para o editor.
 */
export function markdownToHtml(md: string | null | undefined): string {
  if (!md) return "";
  try {
    const raw = marked.parse(md, { async: false }) as string;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  } catch (err) {
    console.warn("markdownToHtml error:", err);
    return "";
  }
}
