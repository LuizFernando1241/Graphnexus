import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { fetchEntityLinks } from "@/lib/api/links";
import { fetchNote } from "@/lib/api/notes";
import { fetchTask } from "@/lib/api/tasks";
import { fetchProject } from "@/lib/api/projects";
import { buildFile, slugify } from "./frontmatter";
import { htmlToMarkdown } from "./convert";
import { makeWikilink } from "./wikilinks";
import type { Note, Task, Project, EntityType, Subtask } from "@/types/entities";

const STORAGE_BUCKET = "nexus_files";

interface ResolvedLink {
  type: EntityType;
  title: string;
}

async function resolveLinks(entityId: string, entityType: EntityType): Promise<ResolvedLink[]> {
  const links = await fetchEntityLinks(entityId, entityType);
  const out: ResolvedLink[] = [];
  for (const l of links) {
    const otherType = l.source_id === entityId ? l.target_type : l.source_type;
    const otherId = l.source_id === entityId ? l.target_id : l.source_id;
    try {
      let title = "";
      if (otherType === "note") title = (await fetchNote(otherId)).title;
      else if (otherType === "task") title = (await fetchTask(otherId)).title;
      else if (otherType === "project") title = (await fetchProject(otherId)).title;
      if (title) out.push({ type: otherType, title });
    } catch {
      // ignore broken links
    }
  }
  return out;
}

/**
 * Encontra caminhos do Supabase Storage referenciados em uma string.
 * URLs assinadas têm o formato: .../storage/v1/object/sign/{bucket}/{path}?token=...
 */
function extractStoragePaths(text: string): string[] {
  const re = new RegExp(`/storage/v1/object/(?:sign|public)/${STORAGE_BUCKET}/([^?"'\\s)]+)`, "g");
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    set.add(decodeURIComponent(m[1]));
  }
  return Array.from(set);
}

async function downloadAttachment(path: string): Promise<{ name: string; blob: Blob } | null> {
  try {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
    if (error || !data) return null;
    const name = path.split("/").pop() || "anexo";
    return { name, blob: data };
  } catch {
    return null;
  }
}

function subtasksToMarkdown(subtasks: Subtask[]): string {
  if (!subtasks || subtasks.length === 0) return "";
  return subtasks
    .map((s) => `- [${s.done ? "x" : " "}] ${s.title}`)
    .join("\n");
}

function linksSection(links: ResolvedLink[]): string {
  if (links.length === 0) return "";
  const lines = links.map((l) => `- ${makeWikilink(l.title)} _(${l.type})_`);
  return `\n## Vínculos\n\n${lines.join("\n")}\n`;
}

function replaceAttachmentRefs(body: string, attachmentMap: Map<string, string>): string {
  let out = body;
  attachmentMap.forEach((relPath, storagePath) => {
    const fileName = storagePath.split("/").pop() || storagePath;
    // Substitui qualquer URL contendo o storagePath
    const re = new RegExp(
      `https?://[^\\s"')]+${storagePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^\\s"')]*`,
      "g",
    );
    out = out.replace(re, relPath);
    // Substitui menções nuas ao caminho
    out = out.replace(new RegExp(storagePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "g"), relPath);
    // Garante que o nome do arquivo apareça em algum lugar caso a regex acima não tenha pegado
    if (!out.includes(relPath) && body.includes(fileName)) {
      out += `\n\n![${fileName}](${relPath})`;
    }
  });
  return out;
}

interface BuildResult {
  filename: string;
  markdown: string;
  attachments: { name: string; blob: Blob }[];
}

async function buildNoteFile(note: Note): Promise<BuildResult> {
  const links = await resolveLinks(note.id, "note");
  let body = htmlToMarkdown(note.content);

  const storagePaths = note.content ? extractStoragePaths(note.content) : [];
  const attachments: { name: string; blob: Blob }[] = [];
  const attachmentMap = new Map<string, string>();
  for (const p of storagePaths) {
    const file = await downloadAttachment(p);
    if (file) {
      attachments.push(file);
      attachmentMap.set(p, `attachments/${file.name}`);
    }
  }
  body = replaceAttachmentRefs(body, attachmentMap);

  const fm: Record<string, unknown> = {
    lovable_type: "note",
    id: note.id,
    title: note.title,
    emoji: note.emoji,
    color: note.color,
    tags: note.tags || [],
    pinned: note.pinned,
    archived: note.archived,
    created_at: note.created_at,
    updated_at: note.updated_at,
    links: links.map((l) => ({ type: l.type, title: l.title })),
    attachments: attachments.map((a) => `attachments/${a.name}`),
  };

  const content =
    `# ${note.title || "Sem título"}\n\n${body}\n${linksSection(links)}`.trimEnd() + "\n";

  return {
    filename: `${slugify(note.title)}.md`,
    markdown: buildFile(fm, content),
    attachments,
  };
}

async function buildTaskFile(task: Task): Promise<BuildResult> {
  const links = await resolveLinks(task.id, "task");
  let body = htmlToMarkdown(task.description);

  const storagePaths = task.description ? extractStoragePaths(task.description) : [];
  const attachments: { name: string; blob: Blob }[] = [];
  const attachmentMap = new Map<string, string>();
  for (const p of storagePaths) {
    const file = await downloadAttachment(p);
    if (file) {
      attachments.push(file);
      attachmentMap.set(p, `attachments/${file.name}`);
    }
  }
  body = replaceAttachmentRefs(body, attachmentMap);

  const subtasksMd = subtasksToMarkdown(task.subtasks || []);

  const fm: Record<string, unknown> = {
    lovable_type: "task",
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    due_time: task.due_time,
    completed_at: task.completed_at,
    estimated_minutes: task.estimated_minutes,
    recurrence_rule: task.recurrence_rule,
    recurrence_end_date: task.recurrence_end_date,
    recurrence_days: task.recurrence_days,
    archived: task.archived,
    created_at: task.created_at,
    updated_at: task.updated_at,
    links: links.map((l) => ({ type: l.type, title: l.title })),
    attachments: attachments.map((a) => `attachments/${a.name}`),
  };

  let content = `# ${task.title || "Sem título"}\n\n`;
  if (body) content += `${body}\n\n`;
  if (subtasksMd) content += `## Subtarefas\n\n${subtasksMd}\n`;
  content += linksSection(links);

  return {
    filename: `${slugify(task.title)}.md`,
    markdown: buildFile(fm, content.trimEnd() + "\n"),
    attachments,
  };
}

async function buildProjectFile(project: Project): Promise<BuildResult> {
  const links = await resolveLinks(project.id, "project");
  let body = htmlToMarkdown(project.description);

  const storagePaths = project.description ? extractStoragePaths(project.description) : [];
  const attachments: { name: string; blob: Blob }[] = [];
  const attachmentMap = new Map<string, string>();
  for (const p of storagePaths) {
    const file = await downloadAttachment(p);
    if (file) {
      attachments.push(file);
      attachmentMap.set(p, `attachments/${file.name}`);
    }
  }
  body = replaceAttachmentRefs(body, attachmentMap);

  const fm: Record<string, unknown> = {
    lovable_type: "project",
    id: project.id,
    title: project.title,
    emoji: project.emoji,
    cover_color: project.cover_color,
    status: project.status,
    start_date: project.start_date,
    target_date: project.target_date,
    archived: project.archived,
    created_at: project.created_at,
    updated_at: project.updated_at,
    links: links.map((l) => ({ type: l.type, title: l.title })),
    attachments: attachments.map((a) => `attachments/${a.name}`),
  };

  const tasks = links.filter((l) => l.type === "task");
  const notes = links.filter((l) => l.type === "note");

  let content = `# ${project.emoji ? project.emoji + " " : ""}${project.title || "Sem título"}\n\n`;
  if (body) content += `${body}\n\n`;
  if (tasks.length) {
    content += `## Tarefas vinculadas\n\n`;
    content += tasks.map((t) => `- ${makeWikilink(t.title)}`).join("\n") + "\n\n";
  }
  if (notes.length) {
    content += `## Notas vinculadas\n\n`;
    content += notes.map((n) => `- ${makeWikilink(n.title)}`).join("\n") + "\n";
  }

  return {
    filename: `${slugify(project.title)}.md`,
    markdown: buildFile(fm, content.trimEnd() + "\n"),
    attachments,
  };
}

async function deliver(result: BuildResult) {
  if (result.attachments.length === 0) {
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, result.filename);
    return;
  }
  const zip = new JSZip();
  zip.file(result.filename, result.markdown);
  const folder = zip.folder("attachments");
  for (const a of result.attachments) folder?.file(a.name, a.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  const zipName = result.filename.replace(/\.md$/, ".zip");
  saveAs(blob, zipName);
}

export async function exportNote(note: Note) {
  const result = await buildNoteFile(note);
  await deliver(result);
}

export async function exportTask(task: Task) {
  const result = await buildTaskFile(task);
  await deliver(result);
}

export async function exportProject(project: Project) {
  const result = await buildProjectFile(project);
  await deliver(result);
}
