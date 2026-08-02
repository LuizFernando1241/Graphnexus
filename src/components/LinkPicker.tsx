import { useState } from "react";
import { StickyNote, CheckSquare, FolderKanban, Search, Crosshair } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EntityType } from "@/types/entities";
import { useMultiEntitySearch } from "@/hooks/useEntitySearch";

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

  const { results } = useMultiEntitySearch(search, { limit: 5, enabled: open });

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
            placeholder="Buscar notas, tarefas, projetos, produtos..."
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
