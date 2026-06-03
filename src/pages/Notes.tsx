import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Archive, Pin, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { fetchNotes, createNote, updateNote, getAllNoteTags } from "@/lib/api/notes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SwipeableItem } from "@/components/ui/SwipeableItem";
import { PageTransition } from "@/components/PageTransition";
import { ImportDropzone } from "@/components/import/ImportDropzone";
import { NotesGridSkeleton } from "@/components/ui/page-skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Note } from "@/types/entities";
import { useDebouncedValue, escapeLikePattern } from "@/lib/utils";

const NOTE_COLORS = [
  "#7C3AED",
  "#2563EB",
  "#059669",
  "#D97706",
  "#DC2626",
  "#DB2777",
  "#4F46E5",
  "#0EA5E9",
];

function NewNoteDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note-tags"] });
      toast.success("Nota criada!");
      setOpen(false);
      setTitle("");
      setEmoji("");
      setColor("#7C3AED");
      setTags([]);
      onCreated();
    },
    onError: () => toast.error("Erro ao criar nota"),
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nova Nota
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Nota</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex gap-3">
            <Input
              placeholder="Emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-20 text-center text-lg"
              maxLength={2}
            />
            <Input
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Cor</Label>
            <div className="flex gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addTag}>
                +
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                  >
                    {t} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => mutation.mutate({ title: title || "Sem título", emoji, color, tags })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Criando..." : "Criar Nota"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col h-full w-full rounded-lg border border-border p-4 text-left transition-all duration-200 active:scale-[0.97] hover:bg-accent"
      style={{
        backgroundColor: `${note.color}26`,
        borderLeftWidth: 4,
        borderLeftColor: note.color || "#7C3AED",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {note.emoji && <span className="text-lg">{note.emoji}</span>}
          <h3 className="font-heading font-semibold text-foreground line-clamp-1">
            {note.title}
          </h3>
        </div>
        <div className="flex gap-1">
          {note.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
          {note.archived && <Archive className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {note.content && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-4 flex-1">
          {(() => {
            try {
              const doc = new DOMParser().parseFromString(note.content, "text/html");
              return (doc.body?.textContent || "").slice(0, 200);
            } catch {
              return "";
            }
          })()}
        </p>
      )}

      {note.tags && note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {note.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

export default function Notes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", debouncedSearch, selectedTags, showArchived],
    queryFn: () => fetchNotes({ search: escapeLikePattern(debouncedSearch), tags: selectedTags, showArchived }),
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["note-tags"],
    queryFn: getAllNoteTags,
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      updateNote(id, { pinned: !pinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota atualizada");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => updateNote(id, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota arquivada");
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <PageTransition>
    <ImportDropzone defaultType="note">
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notas</h1>
        <NewNoteDialog onCreated={() => {}} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar notas"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="archived" className="text-sm text-muted-foreground">
            Arquivadas
          </Label>
        </div>
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <NotesGridSkeleton />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground">
          <StickyNote className="h-10 w-10" />
          <p>Nenhuma nota encontrada.</p>
          <NewNoteDialog onCreated={() => {}} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
          {notes.map((note) => (
            <div key={note.id}>
              <SwipeableItem
                onSwipeRight={() => pinMutation.mutate({ id: note.id, pinned: note.pinned })}
                onSwipeLeft={() => archiveMutation.mutate(note.id)}
                rightIcon={Pin}
                leftIcon={Archive}
                rightBgColor="bg-primary"
                leftBgColor="bg-destructive"
              >
                <NoteCard
                  note={note}
                  onClick={() => navigate(`/notes/${note.id}`)}
                />
              </SwipeableItem>
            </div>
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
