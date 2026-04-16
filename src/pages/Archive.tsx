import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { ArchiveListSkeleton } from "@/components/ui/page-skeleton";
import { Archive as ArchiveIcon } from "lucide-react";

type ArchivedItem = { id: string; title: string; emoji?: string | null };

function useArchivedNotes() {
  return useQuery({
    queryKey: ["archived-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, emoji")
        .eq("archived", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ArchivedItem[];
    },
  });
}

function useArchivedProjects() {
  return useQuery({
    queryKey: ["archived-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, emoji")
        .eq("archived", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ArchivedItem[];
    },
  });
}

function useArchivedTasks() {
  return useQuery({
    queryKey: ["archived-tasks"],
    queryFn: async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Busca segura: duas queries separadas (evita interpolação em .or())
      const twoDaysAgoISO = twoDaysAgo.toISOString();
      
      // Query 1: Tarefas arquivadas
      const { data: archivedData, error: archivedError } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("archived", true)
        .order("updated_at", { ascending: false });
      
      // Query 2: Tarefas completadas há mais de 2 dias
      const { data: oldCompletedData, error: oldCompletedError } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("status", "done")
        .lt("completed_at", twoDaysAgoISO)
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      
      if (archivedError) throw archivedError;
      if (oldCompletedError) throw oldCompletedError;
      
      // Combinar resultados e remover duplicatas
      const combined = new Map<string, ArchivedItem>();
      (archivedData || []).forEach((t) => combined.set(t.id, t));
      (oldCompletedData || []).forEach((t) => combined.set(t.id, t));
      
      return Array.from(combined.values());
    },
  });
}

function ItemRow({
  item,
  onRestore,
  onDelete,
  restoring,
}: {
  item: ArchivedItem;
  onRestore: () => void;
  onDelete: () => void;
  restoring: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm text-foreground truncate">
        {item.emoji ? `${item.emoji} ` : ""}
        {item.title}
      </span>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <Button variant="ghost" size="icon" onClick={onRestore} disabled={restoring} title="Restaurar">
          <RefreshCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Archive() {
  const queryClient = useQueryClient();
  const notes = useArchivedNotes();
  const projects = useArchivedProjects();
  const tasks = useArchivedTasks();

  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string } | null>(null);

  const restoreMutation = useMutation({
    mutationFn: async ({ table, id }: { table: "notes" | "projects" | "tasks"; id: string }) => {
      if (table === "tasks") {
        const { error } = await supabase.from("tasks").update({ archived: false, status: "todo", completed_at: null }).eq("id", id);
        if (error) throw error;
      } else if (table === "notes") {
        const { error } = await supabase.from("notes").update({ archived: false }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").update({ archived: false }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notes"] });
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      queryClient.invalidateQueries({ queryKey: ["archived-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Item restaurado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table as "notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["archived-notes"] });
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      queryClient.invalidateQueries({ queryKey: ["archived-tasks"] });
      toast.success("Item excluído permanentemente.");
    },
  });

  const renderList = (items: ArchivedItem[] | undefined, isLoading: boolean | undefined, table: "notes" | "projects" | "tasks") => {
    if (isLoading) return <ArchiveListSkeleton />;
    if (!items?.length) return (
      <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
        <ArchiveIcon className="h-8 w-8" />
        <p className="text-sm">Nenhum item arquivado.</p>
      </div>
    );
    return (
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            restoring={restoreMutation.isPending}
            onRestore={() => restoreMutation.mutate({ table, id: item.id })}
            onDelete={() => setDeleteTarget({ table, id: item.id })}
          />
        ))}
      </div>
    );
  };

  return (
    <PageTransition>
    <div className="max-w-3xl">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Arquivos</h1>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="projects">Projetos</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">{renderList(notes?.data, notes?.isLoading, "notes")}</TabsContent>
        <TabsContent value="projects">{renderList(projects?.data, projects?.isLoading, "projects")}</TabsContent>
        <TabsContent value="tasks">{renderList(tasks?.data, tasks?.isLoading, "tasks")}</TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageTransition>
  );
}
