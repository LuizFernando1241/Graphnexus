import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StickyNote, CheckSquare, FolderKanban, Search, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EntityType } from "@/types/entities";
import { useDebouncedValue, escapeLikePattern } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  emoji?: string | null;
}

async function searchEntities(query: string): Promise<SearchResult[]> {
  const q = `%${escapeLikePattern(query)}%`;
  const [notes, tasks, projects, products] = await Promise.all([
    supabase.from("notes").select("id, title, emoji").ilike("title", q).limit(5),
    supabase.from("tasks").select("id, title").ilike("title", q).limit(5),
    supabase.from("projects").select("id, title, emoji").ilike("title", q).limit(5),
    supabase.from("radar_produtos").select("id, nome").ilike("nome", q).limit(5),
  ]);

  const results: SearchResult[] = [];
  (notes.data || []).forEach((n) => results.push({ id: n.id, type: "note", title: n.title, emoji: n.emoji }));
  (tasks.data || []).forEach((t) => results.push({ id: t.id, type: "task", title: t.title }));
  (projects.data || []).forEach((p) => results.push({ id: p.id, type: "project", title: p.title, emoji: p.emoji }));
  (products.data || []).forEach((p: { id: string; nome: string }) =>
    results.push({ id: p.id, type: "product", title: p.nome })
  );
  return results;
}

const TYPE_ICONS: Record<EntityType, React.ElementType> = {
  note: StickyNote,
  task: CheckSquare,
  project: FolderKanban,
  product: Crosshair,
};

const TYPE_LABELS: Record<EntityType, string> = {
  note: "Nota",
  task: "Tarefa",
  project: "Projeto",
  product: "Produto",
};

interface LinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeId: string;
  onSelect: (item: { type: EntityType; id: string }) => void;
}

export function LinkPicker({ open, onOpenChange, excludeId, onSelect }: LinkPickerProps) {
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search);

  const { data: results = [] } = useQuery({
    queryKey: ["link-search", debouncedSearch],
    queryFn: () => searchEntities(debouncedSearch),
    enabled: open && debouncedSearch.length > 0,
  });

  const filtered = results.filter((r) => r.id !== excludeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular entidade</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas, tarefas, projetos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {search.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Digite para buscar...</p>
          )}
          {search.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum resultado</p>
          )}
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => {
                  onSelect({ type: item.type, id: item.id });
                  onOpenChange(false);
                  setSearch("");
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="truncate">
                    {item.emoji && `${item.emoji} `}
                    {item.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{TYPE_LABELS[item.type]}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
