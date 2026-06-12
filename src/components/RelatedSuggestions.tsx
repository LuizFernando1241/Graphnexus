import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sparkles, Link2, X, ArrowRight, StickyNote, CheckSquare, FolderKanban, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  acceptSuggestion,
  dismissSuggestion,
  fetchPendingSuggestionsFor,
  type EmbedEntityType,
  type LinkSuggestion,
} from "@/lib/api/embedding";

const TYPE_ICON: Record<EmbedEntityType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote, task: CheckSquare, project: FolderKanban, produto: Crosshair,
};
const TYPE_LABEL: Record<EmbedEntityType, string> = {
  note: "Nota", task: "Tarefa", project: "Projeto", produto: "Produto",
};
const TYPE_ROUTE: Record<EmbedEntityType, (id: string) => string> = {
  note: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  project: (id) => `/projects/${id}`,
  produto: () => `/radar`,
};

interface Props {
  entityType: EmbedEntityType;
  entityId: string;
}

async function fetchOtherTitle(s: LinkSuggestion, self: { type: EmbedEntityType; id: string }) {
  const other = s.source_type === self.type && s.source_id === self.id
    ? { type: s.target_type, id: s.target_id }
    : { type: s.source_type, id: s.source_id };
  const table = other.type === "produto" ? "radar_produtos" : other.type === "note" ? "notes" : other.type === "task" ? "tasks" : "projects";
  const col = other.type === "produto" ? "nome" : "title";
  const { data } = await supabase.from(table).select(`id,${col}`).eq("id", other.id).maybeSingle();
  return { ...other, title: (data as Record<string, string> | null)?.[col] || "(sem título)" };
}

export function RelatedSuggestions({ entityType, entityId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["related-suggestions", entityType, entityId],
    queryFn: () => fetchPendingSuggestionsFor(entityType, entityId),
    staleTime: 30_000,
  });

  const { data: enriched = [] } = useQuery({
    queryKey: ["related-suggestions-enriched", entityType, entityId, suggestions.map((s) => s.id).join(",")],
    queryFn: async () => {
      return Promise.all(
        suggestions.slice(0, 5).map(async (s) => ({ s, other: await fetchOtherTitle(s, { type: entityType, id: entityId }) })),
      );
    },
    enabled: suggestions.length > 0,
  });

  const acceptMut = useMutation({
    mutationFn: (s: LinkSuggestion) => acceptSuggestion(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["related-suggestions", entityType, entityId] });
      qc.invalidateQueries({ queryKey: ["link-suggestions"] });
      qc.invalidateQueries({ queryKey: ["link-suggestions-count"] });
      qc.invalidateQueries({ queryKey: ["entity_links"] });
      qc.invalidateQueries({ queryKey: ["radar-entity-links"] });
      toast.success("Vínculo criado");
    },
    onError: () => toast.error("Erro ao vincular"),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => dismissSuggestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["related-suggestions", entityType, entityId] });
      qc.invalidateQueries({ queryKey: ["link-suggestions-count"] });
    },
  });

  if (suggestions.length === 0) return null;

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Pode estar relacionado a…</h3>
      </div>
      <div className="flex flex-col gap-2">
        {enriched.map(({ s, other }) => {
          const Icon = TYPE_ICON[other.type];
          return (
            <div key={s.id} className="flex items-center gap-2 rounded-md bg-background border border-border p-2">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => navigate(TYPE_ROUTE[other.type](other.id))}
                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:text-primary transition-colors"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs uppercase text-muted-foreground">{TYPE_LABEL[other.type]}</span>
                <span className="truncate text-sm font-medium">{other.title}</span>
              </button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => dismissMut.mutate(s.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-7 px-2" onClick={() => acceptMut.mutate(s)}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
