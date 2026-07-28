import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/entities";

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "backlog", label: "Backlog", dot: "bg-muted-foreground" },
  { id: "todo", label: "A Fazer", dot: "bg-info" },
  { id: "in_progress", label: "Em Progresso", dot: "bg-warning" },
  { id: "done", label: "Concluído", dot: "bg-success" },
];

interface MoveTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: TaskStatus;
  onMove: (newStatus: TaskStatus) => void;
}

export function MoveTaskDrawer({ open, onOpenChange, currentStatus, onMove }: MoveTaskDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle>Mover para...</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 pt-4 pb-8">
          {COLUMNS.filter((col) => col.id !== currentStatus).map((col) => (
            <Button
              key={col.id}
              variant="outline"
              className="justify-start gap-3 min-h-[48px] text-base"
              onClick={() => {
                onMove(col.id);
                onOpenChange(false);
              }}
            >
              <span className={cn("h-3 w-3 rounded-full shrink-0", col.dot)} />
              {col.label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
