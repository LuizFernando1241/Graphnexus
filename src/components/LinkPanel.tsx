import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Plus, Trash2, StickyNote, CheckSquare, FolderKanban, Crosshair } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEntityLinks, useCreateLink, useDeleteLink } from "@/hooks/useLinks";
import { LinkPicker } from "@/components/LinkPicker";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import type { EntityType, EntityLink } from "@/types/entities";
import { supabase } from "@/integrations/supabase/client";

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

interface LinkPanelProps {
  entityId: string;
  entityType: EntityType;
}

function getLinkedEntity(link: EntityLink, selfId: string): { type: EntityType; id: string } {
  if (link.source_id === selfId) {
    return { type: link.target_type, id: link.target_id };
  }
  return { type: link.source_type, id: link.source_id };
}

async function fetchEntityTitles(
  items: { id: string; type: EntityType }[]
): Promise<Record<string, string>> {
  if (items.length === 0) return {};

  const noteIds = items.filter(i => i.type === "note").map(i => i.id);
  const taskIds = items.filter(i => i.type === "task").map(i => i.id);
  const projectIds = items.filter(i => i.type === "project").map(i => i.id);
  const productIds = items.filter(i => i.type === "product").map(i => i.id);

  const [notes, tasks, projects, products] = await Promise.all([
    noteIds.length > 0
      ? supabase.from("notes").select("id, title").in("id", noteIds)
      : Promise.resolve({ data: [] }),
    taskIds.length > 0
      ? supabase.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, title").in("id", projectIds)
      : Promise.resolve({ data: [] }),
    productIds.length > 0
      ? supabase.from("radar_produtos").select("id, nome").in("id", productIds)
      : Promise.resolve({ data: [] }),
  ]);

  const map: Record<string, string> = {};
  [...(notes.data || []), ...(tasks.data || []), ...(projects.data || [])].forEach(
    (e: { id: string; title: string }) => {
      map[e.id] = e.title;
    }
  );
  ((products.data || []) as { id: string; nome: string }[]).forEach((p) => {
    map[p.id] = p.nome;
  });
  return map;
}

function LinkItem({
  link,
  entityId,
  titleMap,
  onDelete,
}: {
  link: EntityLink;
  entityId: string;
  titleMap: Record<string, string>;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const linked = getLinkedEntity(link, entityId);
  const Icon = TYPE_ICONS[linked.type];
  const title = titleMap[linked.id];

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <button
        onClick={() =>
          linked.type === "product"
            ? navigate("/radar", { state: { selecionarProdutoId: linked.id } })
            : navigate(`${TYPE_ROUTES[linked.type]}/${linked.id}`)
        }
        className="flex-1 text-left text-sm truncate text-foreground hover:underline min-h-[44px] flex items-center"
        title={title || ""}
      >
        {title || `${linked.id.slice(0, 8)}…`}
      </button>
      <span className="text-xs text-muted-foreground shrink-0">{TYPE_LABELS[linked.type]}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={onDelete}
        aria-label={`Remover link com ${title || "item"}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function LinkPanel({ entityId, entityType }: LinkPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);
  const { data: links = [], isLoading } = useEntityLinks(entityId, entityType);
  const createLink = useCreateLink(entityId, entityType);
  const deleteLink = useDeleteLink(entityId, entityType);

  // Batch-fetch all linked entity titles in a single query per type
  const linkedEntities = links.map((link) => getLinkedEntity(link, entityId));
  const { data: titleMap = {} } = useQuery({
    queryKey: ["entity-titles", linkedEntities.map((e) => e.id).sort().join(",")],
    queryFn: () => fetchEntityTitles(linkedEntities),
    enabled: linkedEntities.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="h-4 w-4" />
          Links ({links.length})
        </div>
        <Button variant="ghost" size="icon" onClick={() => setPickerOpen(true)} aria-label="Adicionar link">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}

      <div className="flex flex-col gap-1">
        {links.map((link) => (
          <LinkItem
            key={link.id}
            link={link}
            entityId={entityId}
            titleMap={titleMap}
            onDelete={() => setDeleteLinkId(link.id)}
          />
        ))}
        {links.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum link</p>
        )}
      </div>

      <LinkPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeId={entityId}
        onSelect={(target) => createLink.mutate(target)}
      />

      {/* Delete Link Confirmation */}
      <AlertDialog open={!!deleteLinkId} onOpenChange={() => setDeleteLinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover link</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este link? A ação pode ser refeita manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteLinkId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteLinkId) {
                  deleteLink.mutate(deleteLinkId);
                  setDeleteLinkId(null);
                }
              }}
            >
              Remover
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
