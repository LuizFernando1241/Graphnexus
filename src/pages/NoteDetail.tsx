import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Pin, PinOff, Archive, ArchiveRestore, Trash2, ChevronRight } from "lucide-react";
import { useNoteDetail } from "@/hooks/useNoteDetail";
import { LinkPanel } from "@/components/LinkPanel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    note,
    isLoading,
    title,
    emoji,
    content,
    hasUnsavedChanges,
    setTitle,
    setEmoji,
    setContent,
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

      <div className="flex flex-col lg:flex-row gap-6 max-w-5xl">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
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
              <Button variant="ghost" size="icon" onClick={handleArchive} disabled={archiveMutation.isPending} title={note.archived ? "Desarquivar" : "Arquivar"} aria-label={note.archived ? "Desarquivar nota" : "Arquivar nota"}>
                {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} aria-label="Excluir nota">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title + Emoji */}
          <div className="flex items-center gap-3">
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="😀" className="w-14 text-center text-2xl bg-transparent border-border" maxLength={2} aria-label="Emoji da nota" />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Título da nota" aria-label="Título da nota" />
          </div>

          {/* Editor */}
          <RichTextEditor content={content} onChange={setContent} />
        </div>

        {/* Right sidebar - Links */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto hidden-scrollbar">
          <LinkPanel entityId={id!} entityType="note" />
        </div>
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
