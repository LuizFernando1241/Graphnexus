import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Link } from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  CodeSquare,
  TableIcon,
  Link as LinkIcon,
  Unlink,
  Trash2,
  Columns,
  Rows,
  Camera,
  Paperclip,
  Palette,
  Minus,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, isImageFile } from "@/lib/storage";
import { useHeadingFold } from "@/hooks/useHeadingFold";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  /**
   * Optional storage key used to persist the collapsed-headings state
   * (Obsidian-style folding) across reloads. When omitted, fold state is
   * kept only in memory for the current editor session.
   */
  foldStorageKey?: string;
}

interface SearchResult {
  id: string;
  title: string;
  type: "note" | "task" | "project";
  emoji?: string | null;
}

const FONT_COLORS = [
  { label: "Padrão", value: "" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Laranja", value: "#F97316" },
  { label: "Amarelo", value: "#EAB308" },
  { label: "Verde", value: "#22C55E" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Roxo", value: "#8B5CF6" },
  { label: "Rosa", value: "#EC4899" },
  { label: "Cinza", value: "#6B7280" },
  { label: "Branco", value: "#FFFFFF" },
];

const ToolbarButton = ({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`rounded p-1.5 transition-colors ${
      isActive
        ? "bg-accent text-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

function ColorPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  if (!editor) return null;

  const currentColor = editor.getAttributes("textStyle").color || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Cor do texto"
          className="rounded p-1.5 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground relative"
        >
          <Palette className="h-4 w-4" />
          {currentColor && (
            <span
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {FONT_COLORS.map((c) => (
            <button
              key={c.value || "default"}
              title={c.label}
              onClick={() => {
                if (c.value) {
                  editor.chain().focus().setColor(c.value).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
                setOpen(false);
              }}
              className={`h-7 w-7 rounded-md border border-border hover:scale-110 transition-transform ${
                currentColor === c.value ? "ring-2 ring-primary" : ""
              }`}
              style={{
                backgroundColor: c.value || "transparent",
                ...((!c.value) ? { background: "linear-gradient(135deg, #ccc 25%, transparent 25%, transparent 50%, #ccc 50%, #ccc 75%, transparent 75%)", backgroundSize: "6px 6px" } : {}),
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InternalLinkPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const pattern = `%${q}%`;
    const [notes, tasks, projects] = await Promise.all([
      supabase.from("notes").select("id, title, emoji").ilike("title", pattern).limit(5),
      supabase.from("tasks").select("id, title").ilike("title", pattern).limit(5),
      supabase.from("projects").select("id, title, emoji").ilike("title", pattern).limit(5),
    ]);
    const items: SearchResult[] = [
      ...(notes.data || []).map((n) => ({ id: n.id, title: n.title, emoji: n.emoji, type: "note" as const })),
      ...(tasks.data || []).map((t) => ({ id: t.id, title: t.title, emoji: null, type: "task" as const })),
      ...(projects.data || []).map((p) => ({ id: p.id, title: p.title, emoji: p.emoji, type: "project" as const })),
    ];
    return items;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await doSearch(search);
      if (!cancelled && results) {
        setResults(results);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, doSearch]);

  const insertLink = (item: SearchResult) => {
    if (!editor) return;
    const href = `/${item.type}s/${item.id}`;
    const label = `${item.emoji ? item.emoji + " " : ""}${item.title}`;

    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${href}">${label}</a>`)
        .run();
    }
    setOpen(false);
    setSearch("");
    setResults([]);
  };

  const typeLabels: Record<string, string> = { note: "Nota", task: "Tarefa", project: "Projeto" };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Link interno"
          className="rounded p-1.5 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Buscar nota, tarefa ou projeto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
          autoFocus
        />
        {results.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {results.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => insertLink(item)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
              >
                <span className="shrink-0 text-xs text-muted-foreground">
                  {typeLabels[item.type]}
                </span>
                <span className="truncate">
                  {item.emoji && <span className="mr-1">{item.emoji}</span>}
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        )}
        {search.trim() && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function RichTextEditor({ content, onChange, foldStorageKey }: RichTextEditorProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const foldOverlayRef = useRef<HTMLDivElement>(null);

  const handleUpload = useCallback(async (file: File | null | undefined) => {
    if (!file) return;

    const url = await uploadFile(file);
    const editor = editorRef.current;
    if (!url || !editor) return;

    if (isImageFile(file)) {
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } else {
      const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="editor-link">📎 ${file.name}</a>`;
      editor.chain().focus().insertContent(linkHtml).run();
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Placeholder.configure({ placeholder: "Comece a escrever..." }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "editor-link" },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "editor-image" },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-editor outline-none min-h-[60vh] md:min-h-[70vh] lg:min-h-[75vh] px-4 md:px-6 lg:px-8 py-4 md:py-6 text-foreground text-base md:text-[17px] leading-relaxed max-w-3xl xl:max-w-4xl mx-auto w-full",
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Obsidian-style hierarchical heading folding (renders chevrons in overlay)
  useHeadingFold(editor, foldOverlayRef, foldStorageKey);

  if (!editor) return null;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      {/* Sticky Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-secondary px-3 py-2 flex-wrap sticky top-0 md:top-0 z-20 rounded-t-lg">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Negrito">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Itálico">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Tachado">
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ColorPicker editor={editor} />

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Título 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Título 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Título 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Lista">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Código inline">
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Bloco de código">
          <CodeSquare className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          isActive={false}
          title="Inserir tabela"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        {editor.isActive("table") && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} isActive={false} title="Adicionar linha">
              <Rows className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} isActive={false} title="Remover linha">
              <Minus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} isActive={false} title="Adicionar coluna">
              <Columns className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} isActive={false} title="Remover coluna">
              <Minus className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} isActive={false} title="Deletar tabela">
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => {
            const url = window.prompt("Digite a URL:");
            if (url) {
              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }
          }}
          isActive={editor.isActive("link")}
          title="Adicionar link externo"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        {editor.isActive("link") && (
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} isActive={false} title="Remover link">
            <Unlink className="h-4 w-4" />
          </ToolbarButton>
        )}

        <InternalLinkPicker editor={editor} />

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Botão Câmera/Foto */}
        <label
          title="Câmera/Foto"
          className="rounded p-1.5 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Camera className="h-4 w-4" />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </label>

        {/* Botão Anexar Doc */}
        <label
          title="Anexar documento (PDF, DOC, TXT)"
          className="rounded p-1.5 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Paperclip className="h-4 w-4" />
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,image/*"
            hidden
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </label>
      </div>

      {/* Editor (with overlay layer for heading-fold chevrons) */}
      <div className="relative">
        <div
          ref={foldOverlayRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
