import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Pin, PinOff, Archive, ArchiveRestore, Trash2, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { exportNote } from "@/lib/markdown/export";
import { useNoteDetail } from "@/hooks/useNoteDetail";
import { LinkPanelDock } from "@/components/LinkPanelDock";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

const NOTE_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#0EA5E9"];

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    note,
    isLoading,
    title,
    emoji,
    content,
    color,
    tags,
    hasUnsavedChanges,
    setTitle,
    setEmoji,
    setContent,
    setColor,
    setTags,
    handleSave,
    handlePin,
    handleArchive,
    handleDelete,
    blocker,
    saveMutation,
    pinMutation,
    archiveMutation,
    deleteMutation,
  } = useNoteDetail(id);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasUnsavedChanges, handleSave]);

  const proceedWithBlocker = () => blocker.proceed?.();

  if (isLoading || !note) {
    return <DetailPageSkeleton />;
  }

  return (
    <>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <Link to="/notes" className="hover:text-foreground transition-colors">
          Notas
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate max-w-[200px]">
          {emoji && `${emoji} `}{title || "Sem título"}
        </span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/notes")} className="min-h-[44px]">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnsavedChanges && (
                <span className="text-xs text-primary animate-pulse">Alterações não salvas</span>
              )}
              <Button onClick={handleSave} disabled={!hasUnsavedChanges || saveMutation.isPending} size="sm">
                <Save className="mr-1 h-4 w-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePin} disabled={pinMutation.isPending} title={note.pinned ? "Desafixar" : "Fixar"} aria-label={note.pinned ? "Desafixar nota" : "Fixar nota"}>
                {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Exportar como Markdown"
                aria-label="Exportar nota como Markdown"
                onClick={async () => {
                  try { await exportNote(note); toast.success("Exportado!"); }
                  catch { toast.error("Falha ao exportar"); }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleArchive} disabled={archiveMutation.isPending} title={note.archived ? "Desarquivar" : "Arquivar"} aria-label={note.archived ? "Desarquivar nota" : "Arquivar nota"}>
                {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} aria-label="Excluir nota">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title + Emoji — aligned with editor's gutter */}
          <div className="w-full px-[1.75rem] flex items-center gap-3">
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="😀" className="w-14 text-center text-2xl bg-transparent border-border shrink-0" maxLength={2} aria-label="Emoji da nota" />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 text-2xl md:text-3xl font-heading font-bold bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0" placeholder="Título da nota" aria-label="Título da nota" />
          </div>

          {/* Color + Tags */}
          <div className="w-full px-[1.75rem] flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Cor ${c}`}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      color === c ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  className="flex-1 h-9"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addTag}>+</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => removeTag(t)}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <RichTextEditor
            content={content}
            onChange={setContent}
            foldStorageKey={id ? `note:${id}` : undefined}
          />
        </div>

        {/* Right sidebar - Links (resizable on desktop) */}
        <LinkPanelDock entityId={id!} entityType="note" />
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta nota? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Blocker Dialog */}
      <AlertDialog open={blocker.state === "blocked"} onOpenChange={() => blocker.reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações que ainda não foram salvas. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => blocker.reset?.()}>Voltar</Button>
            <Button variant="secondary" onClick={proceedWithBlocker}>Descartar</Button>
            <Button onClick={async () => { await saveMutation.mutateAsync(); blocker.proceed?.(); }} disabled={saveMutation.isPending}>
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
