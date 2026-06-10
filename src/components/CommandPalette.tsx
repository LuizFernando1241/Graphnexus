import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StickyNote, CheckSquare, FolderKanban, Search, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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

const TYPE_ROUTES: Record<EntityType, string> = {
  note: "/notes",
  task: "/tasks",
  project: "/projects",
  product: "/radar",
};

async function searchAll(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = `%${escapeLikePattern(query)}%`;
  
  // Busca segura: duas queries por entidade (evita interpolação em .or())
  // Notes: busca em title e content separadamente
  const [notesTitle, notesContent, tasksTitle, tasksDesc, projectsTitle, projectsDesc] = await Promise.all([
    supabase.from("notes").select("id, title, emoji").ilike("title", q).eq("archived", false).limit(5),
    supabase.from("notes").select("id, title, emoji").ilike("content", q).eq("archived", false).limit(5),
    supabase.from("tasks").select("id, title").ilike("title", q).eq("archived", false).limit(5),
    supabase.from("tasks").select("id, title").ilike("description", q).eq("archived", false).limit(5),
    supabase.from("projects").select("id, title, emoji").ilike("title", q).eq("archived", false).limit(5),
    supabase.from("projects").select("id, title, emoji").ilike("description", q).eq("archived", false).limit(5),
  ]);

  // Combinar resultados e remover duplicatas
  const combined = new Map<string, SearchResult>();
  
  (notesTitle.data || []).forEach((n) => combined.set(n.id, { id: n.id, type: "note", title: n.title, emoji: n.emoji }));
  (notesContent.data || []).forEach((n) => combined.set(n.id, { id: n.id, type: "note", title: n.title, emoji: n.emoji }));
  (tasksTitle.data || []).forEach((t) => combined.set(t.id, { id: t.id, type: "task", title: t.title }));
  (tasksDesc.data || []).forEach((t) => combined.set(t.id, { id: t.id, type: "task", title: t.title }));
  (projectsTitle.data || []).forEach((p) => combined.set(p.id, { id: p.id, type: "project", title: p.title, emoji: p.emoji }));
  (projectsDesc.data || []).forEach((p) => combined.set(p.id, { id: p.id, type: "project", title: p.title, emoji: p.emoji }));
  
  return Array.from(combined.values());
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const debouncedSearch = useDebouncedValue(search);

  const { data: results = [] } = useQuery({
    queryKey: ["cmd-search", debouncedSearch],
    queryFn: () => searchAll(debouncedSearch),
    enabled: open && debouncedSearch.length > 0,
  });

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const select = useCallback(
    (item: SearchResult) => {
      navigate(`${TYPE_ROUTES[item.type]}/${item.id}`);
      setOpen(false);
      setSearch("");
    },
    [navigate]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogTitle className="sr-only">Busca rápida</DialogTitle>
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar notas, tarefas, projetos... (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-none focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
            aria-label="Buscar notas, tarefas e projetos"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {search.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Digite para buscar...</p>
          )}
          {search.length > 0 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum resultado</p>
          )}
          {results.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => select(item)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">
                  {item.emoji && `${item.emoji} `}{item.title}
                </span>
                <span className="text-xs text-muted-foreground">{TYPE_LABELS[item.type]}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
