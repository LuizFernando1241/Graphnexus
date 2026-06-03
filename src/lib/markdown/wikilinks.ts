const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface Wikilink {
  raw: string;
  title: string;
  alias?: string;
}

export function extractWikilinks(body: string): Wikilink[] {
  const out: Wikilink[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    out.push({ raw: m[0], title: m[1].trim(), alias: m[2]?.trim() });
  }
  return out;
}

export function makeWikilink(title: string, alias?: string): string {
  const safe = title.replace(/[\[\]|]/g, "");
  return alias ? `[[${safe}|${alias}]]` : `[[${safe}]]`;
}
