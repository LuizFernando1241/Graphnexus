import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { updateTask } from "@/lib/api/tasks";
import { useQuickCreateTask } from "@/hooks/useQuickCreate";
import { invalidateAllEntities } from "@/lib/cache";
import type { Task } from "@/types/entities";

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluída",
  cancelled: "Cancelada",
};

interface Props {
  projectId: string;
  tasks: Task[];
  isLoading: boolean;
}

export function ProjectTasksTab({ projectId, tasks, isLoading }: Props) {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { createSimpleTask, isPending } = useQuickCreateTask({
    defaultStatus: "todo",
    projectId,
  });

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    createSimpleTask(title);
    setNewTitle("");
    invalidateAllEntities(qc);
    toast.success("Tarefa adicionada");
  };

  const toggleMut = useMutation({
    mutationFn: async (t: Task) => {
      const done = t.status === "done";
      return updateTask(t.id, {
        status: done ? "todo" : "done",
        completed_at: done ? null : new Date().toISOString(),
        manualStatusChange: true,
      } as any);
    },
    onSuccess: () => invalidateAllEntities(qc),
  });

  const sorted = [...tasks].sort((a, b) => {
    const order = { in_progress: 0, todo: 1, backlog: 2, done: 3, cancelled: 4 } as Record<string, number>;
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); addTask(); }}
        className="flex gap-2"
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova tarefa neste projeto..."
        />
        <Button type="submit" size="sm" disabled={!newTitle.trim() || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa vinculada ainda.
        </Card>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {sorted.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <Checkbox
                checked={t.status === "done"}
                onCheckedChange={() => toggleMut.mutate(t)}
              />
              <Link
                to={`/tasks/${t.id}`}
                className={`flex-1 text-sm hover:text-primary truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
              >
                {t.title}
              </Link>
              <Badge variant="secondary" className="text-xs shrink-0">{STATUS_LABEL[t.status] || t.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
