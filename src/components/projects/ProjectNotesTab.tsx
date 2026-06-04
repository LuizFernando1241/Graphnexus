import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Note } from "@/types/entities";

interface Props {
  notes: Note[];
  isLoading: boolean;
}

export function ProjectNotesTab({ notes, isLoading }: Props) {
  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (notes.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma nota vinculada ainda.</Card>;
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {notes.map((n) => (
        <li key={n.id}>
          <Link to={`/notes/${n.id}`}>
            <Card className="p-3 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{n.emoji ? `${n.emoji} ` : ""}{n.title || "Sem título"}</div>
                  {n.tags && n.tags.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">#{n.tags.join(" #")}</div>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
