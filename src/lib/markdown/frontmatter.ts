import yaml from "js-yaml";

export interface ParsedFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Serializa frontmatter + corpo em formato `--- yaml --- body`.
 */
export function buildFile(frontmatter: Record<string, unknown>, body: string): string {
  const yml = yaml.dump(frontmatter, { lineWidth: 120, noRefs: true }).trimEnd();
  return `---\n${yml}\n---\n\n${body.trimStart()}\n`;
}

/**
 * Faz o parse de um arquivo markdown com frontmatter opcional.
 */
export function parseFile(raw: string): ParsedFile {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }
  let fm: Record<string, unknown> = {};
  try {
    const loaded = yaml.load(match[1]);
    if (loaded && typeof loaded === "object") fm = loaded as Record<string, unknown>;
  } catch (err) {
    console.warn("Falha ao parsear frontmatter:", err);
  }
  return { frontmatter: fm, body: match[2] ?? "" };
}

/**
 * Slug seguro para nomes de arquivos.
 */
export function slugify(input: string): string {
  return (input || "sem-titulo")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "sem-titulo";
}
