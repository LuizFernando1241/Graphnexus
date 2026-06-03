import JSZip from "jszip";
import { parseFile, slugify } from "./frontmatter";
import { markdownToHtml } from "./convert";
import { extractWikilinks } from "./wikilinks";
import { createNote } from "@/lib/api/notes";
import { createTask } from "@/lib/api/tasks";
import { createProject } from "@/lib/api/projects";
import { createEntityLink } from "@/lib/api/links";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType, Subtask, TaskPriority, TaskStatus, ProjectStatus } from "@/types/entities";

const STORAGE_BUCKET = "nexus_files";

export interface ParsedItem {
  /** Identificador único na sessão de importação. */
  key: string;
  /** Caminho do arquivo no zip (ou nome do .md). */
  source: string;
  type: EntityType;
  title: string;
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
  attachments: Map<string, Blob>;
  /** Tipos detectados pelo parser. */
  warnings: string[];
}

function inferType(fm: Record<string, unknown>, filePath: string, defaultType: EntityType): EntityType {
  const t = (fm.lovable_type as string) || (fm.type as string);
  if (t === "note" || t === "task" || t === "project") return t;
  if (filePath.startsWith("notes/")) return "note";
  if (filePath.startsWith("tasks/")) return "task";
  if (filePath.startsWith("projects/")) return "project";
  return defaultType;
}

function getTitle(fm: Record<string, unknown>, body: string, filePath: string): string {
  if (typeof fm.title === "string" && fm.title.trim()) return fm.title.trim();
  const m = body.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim().replace(/^\p{Emoji}+\s*/u, "");
  const base = filePath.split("/").pop() || "Sem título";
  return base.replace(/\.md$/i, "").replace(/[-_]+/g, " ");
}

/**
 * Remove a primeira linha "# título" do corpo se já corresponde ao título.
 */
function stripLeadingHeading(body: string, title: string): string {
  const re = new RegExp(`^#\\s+\\p{Emoji}*\\s*${title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\n+`, "u");
  return body.replace(re, "");
}

/**
 * Extrai subtasks (linhas "- [ ] ...") e devolve `{ subtasks, bodyWithoutSubtasks }`.
 */
function extractSubtasks(body: string): { subtasks: Subtask[]; body: string } {
  const lines = body.split(/\r?\n/);
  const subtasks: Subtask[] = [];
  const kept: string[] = [];
  const re = /^\s*[-*]\s*\[( |x|X)\]\s+(.+)$/;
  let inSubsHeading = false;
  for (const line of lines) {
    if (/^##\s+Subtarefas\s*$/i.test(line)) {
      inSubsHeading = true;
      continue;
    }
    const m = line.match(re);
    if (m && (inSubsHeading || subtasks.length === 0)) {
      subtasks.push({
        id: crypto.randomUUID(),
        title: m[2].trim(),
        done: m[1].toLowerCase() === "x",
      });
      continue;
    }
    if (inSubsHeading && line.trim() === "") continue;
    if (inSubsHeading && line.startsWith("#")) inSubsHeading = false;
    kept.push(line);
  }
  return { subtasks, body: kept.join("\n").trim() };
}

export async function parseMarkdownString(
  raw: string,
  fileName: string,
  defaultType: EntityType,
  attachments: Map<string, Blob> = new Map(),
): Promise<ParsedItem> {
  const { frontmatter, body } = parseFile(raw);
  const type = inferType(frontmatter, fileName, defaultType);
  const title = getTitle(frontmatter, body, fileName);
  const warnings: string[] = [];
  if (!frontmatter.lovable_type) warnings.push("Sem frontmatter Lovable — importado como " + type);
  return {
    key: crypto.randomUUID(),
    source: fileName,
    type,
    title,
    raw,
    frontmatter,
    body,
    attachments,
    warnings,
  };
}

export async function parseFiles(files: File[], defaultType: EntityType): Promise<ParsedItem[]> {
  const out: ParsedItem[] = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      const attachmentsByFolder = new Map<string, Map<string, Blob>>();

      // 1ª passada: coletar anexos por pasta-pai
      const entries: { path: string; entry: JSZip.JSZipObject }[] = [];
      zip.forEach((path, entry) => {
        if (entry.dir) return;
        entries.push({ path, entry });
      });

      for (const { path, entry } of entries) {
        if (/(^|\/)attachments\//.test(path)) {
          const folder = path.replace(/(^|\/)attachments\/[^/]+$/, "$1").replace(/\/$/, "");
          const blob = await entry.async("blob");
          if (!attachmentsByFolder.has(folder)) attachmentsByFolder.set(folder, new Map());
          attachmentsByFolder.get(folder)!.set(path, blob);
        }
      }

      for (const { path, entry } of entries) {
        if (!path.toLowerCase().endsWith(".md")) continue;
        const text = await entry.async("string");
        const folder = path.replace(/[^/]+$/, "").replace(/\/$/, "");
        const att = attachmentsByFolder.get(folder) || new Map();
        out.push(await parseMarkdownString(text, path, defaultType, att));
      }
    } else if (file.name.toLowerCase().endsWith(".md")) {
      const text = await file.text();
      out.push(await parseMarkdownString(text, file.name, defaultType));
    }
  }
  return out;
}

async function uploadAttachment(name: string, blob: Blob): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const safeName = name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return null;
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl || null;
}

async function uploadAndReplaceAttachments(body: string, attachments: Map<string, Blob>): Promise<string> {
  if (attachments.size === 0) return body;
  let out = body;
  for (const [path, blob] of attachments) {
    const name = path.split("/").pop() || "anexo";
    const signed = await uploadAttachment(name, blob);
    if (!signed) continue;
    // Substitui referências relativas a attachments/<name> ou ao path completo
    const relRefs = [`attachments/${name}`, path];
    for (const ref of relRefs) {
      const safe = ref.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
      out = out.replace(new RegExp(safe, "g"), signed);
    }
  }
  return out;
}

export interface ImportResult {
  created: { type: EntityType; id: string; title: string }[];
  skipped: { source: string; reason: string }[];
}

/**
 * Importa uma lista de items previamente parseados. Cria cada entidade, faz upload
 * dos anexos e, no fim, resolve wikilinks para criar `entity_links`.
 */
export async function importItems(items: ParsedItem[]): Promise<ImportResult> {
  const created: ImportResult["created"] = [];
  const skipped: ImportResult["skipped"] = [];
  const titleIndex = new Map<string, { type: EntityType; id: string }>();

  for (const item of items) {
    try {
      const cleanBody = stripLeadingHeading(item.body, item.title);

      if (item.type === "note") {
        const finalBody = await uploadAndReplaceAttachments(cleanBody, item.attachments);
        const html = markdownToHtml(finalBody);
        const fm = item.frontmatter;
        const note = await createNote({
          title: item.title,
          emoji: typeof fm.emoji === "string" ? fm.emoji : undefined,
          color: typeof fm.color === "string" ? fm.color : undefined,
          content: html,
          tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
        });
        created.push({ type: "note", id: note.id, title: note.title });
        titleIndex.set(note.title.toLowerCase(), { type: "note", id: note.id });
      } else if (item.type === "task") {
        const { subtasks, body: bodyNoSubs } = extractSubtasks(cleanBody);
        const finalBody = await uploadAndReplaceAttachments(bodyNoSubs, item.attachments);
        const html = markdownToHtml(finalBody);
        const fm = item.frontmatter;
        const task = await createTask({
          title: item.title,
          description: html,
          status: (fm.status as TaskStatus) || "backlog",
          priority: (fm.priority as TaskPriority) || "none",
          due_date: (fm.due_date as string) || null,
          due_time: (fm.due_time as string) || null,
          estimated_minutes: typeof fm.estimated_minutes === "number" ? fm.estimated_minutes : null,
          recurrence_rule: (fm.recurrence_rule as string) || null,
          recurrence_end_date: (fm.recurrence_end_date as string) || null,
          recurrence_days: Array.isArray(fm.recurrence_days) ? (fm.recurrence_days as number[]) : null,
          subtasks,
        });
        created.push({ type: "task", id: task.id, title: task.title });
        titleIndex.set(task.title.toLowerCase(), { type: "task", id: task.id });
      } else if (item.type === "project") {
        const finalBody = await uploadAndReplaceAttachments(cleanBody, item.attachments);
        const html = markdownToHtml(finalBody);
        const fm = item.frontmatter;
        const project = await createProject({
          title: item.title,
          description: html,
          emoji: typeof fm.emoji === "string" ? fm.emoji : undefined,
          cover_color: typeof fm.cover_color === "string" ? fm.cover_color : undefined,
        });
        created.push({ type: "project", id: project.id, title: project.title });
        titleIndex.set(project.title.toLowerCase(), { type: "project", id: project.id });
      }
    } catch (err) {
      console.error("Erro ao importar item:", item.source, err);
      skipped.push({ source: item.source, reason: (err as Error).message });
    }
  }

  // Resolve wikilinks → entity_links
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const created_i = created.find((c) => c.title === item.title && c.type === item.type);
    if (!created_i) continue;
    const links = extractWikilinks(item.body);
    for (const l of links) {
      const target = titleIndex.get(l.title.toLowerCase());
      if (!target) continue;
      if (target.id === created_i.id) continue;
      try {
        await createEntityLink({
          source_type: item.type,
          source_id: created_i.id,
          target_type: target.type,
          target_id: target.id,
        });
      } catch {
        // duplicado — ignorar
      }
    }
    // Frontmatter links explícitos
    const fmLinks = Array.isArray(item.frontmatter.links) ? (item.frontmatter.links as Array<{ title?: string; type?: string }>) : [];
    for (const fl of fmLinks) {
      if (!fl?.title) continue;
      const target = titleIndex.get(String(fl.title).toLowerCase());
      if (!target || target.id === created_i.id) continue;
      try {
        await createEntityLink({
          source_type: item.type,
          source_id: created_i.id,
          target_type: target.type,
          target_id: target.id,
        });
      } catch {
        // ignore
      }
    }
  }

  return { created, skipped };
}
