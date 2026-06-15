import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, StickyNote, CheckSquare, FolderKanban, Send } from "lucide-react";
import { toast } from "sonner";
import { createNote } from "@/lib/api/notes";
import { createTask } from "@/lib/api/tasks";
import { createProject } from "@/lib/api/projects";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function QuickAdd({ externalOpen, onExternalOpenChange }: { externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickText, setQuickText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Sync with external open state (from hotkey)
  const isDialogOpen = externalOpen ?? dialogOpen;
  const setIsDialogOpen = useCallback((open: boolean) => {
    setDialogOpen(open);
    onExternalOpenChange?.(open);
  }, [onExternalOpenChange]);

  const noteMutation = useMutation({
    mutationFn: () => createNote({ title: "Sem título" }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota criada!");
      navigate(`/notes/${note.id}`);
    },
  });

  const taskMutation = useMutation({
    mutationFn: (params: { title: string; due_date?: string | null; status?: string; priority?: string }) =>
      createTask(params),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada!");
      setIsDialogOpen(false);
      setQuickText("");
      navigate(`/tasks/${task.id}`);
    },
  });

  const projectMutation = useMutation({
    mutationFn: () => createProject({ title: "Novo projeto" }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado!");
      navigate(`/projects/${project.id}`);
    },
  });

  const handleQuickTask = () => {
    if (!quickText.trim()) return;
    const parsed = parseTaskInput(quickText);
    taskMutation.mutate({
      title: parsed.title,
      due_date: parsed.due_date,
      status: parsed.status,
      priority: parsed.priority,
    });
  };

  return (
    <div className="flex flex-col items-end gap-3">
      {/* Quick Task Dialog - stable, won't close on accidental taps */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Nova Tarefa Rápida</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuickTask();
            }}
            className="flex flex-col gap-4"
          >
            <Input
              placeholder='Ex: "comprar pão amanhã"'
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              className="text-base min-h-[48px]"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Datas, prioridade e status são detectados automaticamente ✨
            </p>
            <DialogFooter className="flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => {
                  setIsDialogOpen(false);
                  setQuickText("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="min-h-[44px] gap-2"
                disabled={!quickText.trim() || taskMutation.isPending}
              >
                <Send className="h-4 w-4" />
                {taskMutation.isPending ? "Criando..." : "Criar Tarefa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg transition-all duration-200 active:scale-[0.97]">
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2">
          <DropdownMenuItem onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending}>
            <StickyNote className="mr-2 h-4 w-4" /> Nova Nota
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
            <CheckSquare className="mr-2 h-4 w-4" /> Nova Tarefa Rápida
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => projectMutation.mutate()} disabled={projectMutation.isPending}>
            <FolderKanban className="mr-2 h-4 w-4" /> Novo Projeto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
