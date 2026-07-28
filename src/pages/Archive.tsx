import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTransition } from "@/components/PageTransition";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useMemo, useState } from "react";
import { ArchiveListSkeleton } from "@/components/ui/page-skeleton";
import { Archive as ArchiveIcon } from "lucide-react";

type ArchivedItem = { id: string; title: string; emoji?: string | null; sub?: string };

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
      const twoDaysAgoISO = twoDaysAgo.toISOString();

      const { data: archivedData, error: archivedError } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("archived", true)
        .order("updated_at", { ascending: false });

      const { data: oldCompletedData, error: oldCompletedError } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("status", "done")
        .lt("completed_at", twoDaysAgoISO)
        .eq("archived", false)
        .order("updated_at", { ascending: false });

      if (archivedError) throw archivedError;
      if (oldCompletedError) throw oldCompletedError;

      const combined = new Map<string, ArchivedItem>();
      (archivedData || []).forEach((t) => combined.set(t.id, t));
      (oldCompletedData || []).forEach((t) => combined.set(t.id, t));

      return Array.from(combined.values());
    },
  });
}

function useArchivedProducts() {
  return useQuery({
    queryKey: ["archived-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radar_produtos")
        .select("id, nome, fornecedor")
        .eq("stage", "arquivado")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(
        (p: { id: string; nome: string; fornecedor: string }): ArchivedItem => ({
          id: p.id,
          title: p.nome,
          sub: p.fornecedor,
        }),
      );
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
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">
          {item.emoji ? `${item.emoji} ` : ""}
          {item.title}
        </p>
        {item.sub && (
          <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
        )}
      </div>
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

type ArchiveTable = "notes" | "projects" | "tasks" | "radar_produtos";

export default function Archive() {
  const queryClient = useQueryClient();
  const notes = useArchivedNotes();
  const projects = useArchivedProjects();
  const tasks = useArchivedTasks();
  const products = useArchivedProducts();

  const [deleteTarget, setDeleteTarget] = useState<{ table: ArchiveTable; id: string } | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const restoreMutation = useMutation({
    mutationFn: async ({ table, id }: { table: ArchiveTable; id: string }) => {
      if (table === "tasks") {
        const { error } = await supabase.from("tasks").update({ archived: false, status: "todo", completed_at: null }).eq("id", id);
        if (error) throw error;
      } else if (table === "notes") {
        const { error } = await supabase.from("notes").update({ archived: false }).eq("id", id);
        if (error) throw error;
      } else if (table === "projects") {
        const { error } = await supabase.from("projects").update({ archived: false }).eq("id", id);
        if (error) throw error;
      } else {
        // radar_produtos: volta para 'aprovado'
        const { error } = await supabase
          .from("radar_produtos")
          .update({ stage: "aprovado", stage_entered_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notes"] });
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      queryClient.invalidateQueries({ queryKey: ["archived-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["archived-products"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["radar-produtos"] });
      toast.success("Item restaurado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: ArchiveTable; id: string }) => {
      const { error } = await supabase.from(table as "notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["archived-notes"] });
      queryClient.invalidateQueries({ queryKey: ["archived-projects"] });
      queryClient.invalidateQueries({ queryKey: ["archived-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["archived-products"] });
      queryClient.invalidateQueries({ queryKey: ["radar-produtos"] });
      toast.success("Item excluído permanentemente.");
    },
  });

  const renderList = (
    items: ArchivedItem[] | undefined,
    isLoading: boolean | undefined,
    table: ArchiveTable,
  ) => {
    if (isLoading) return <ArchiveListSkeleton />;
    if (!items?.length)
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <ArchiveIcon className="h-8 w-8" />
          <p className="text-sm">Nenhum item arquivado.</p>
        </div>
      );
    return (
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
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

  const filteredProducts = useMemo(() => {
    const all = products?.data ?? [];
    const term = productSearch.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        (p.sub ?? "").toLowerCase().includes(term),
    );
  }, [products?.data, productSearch]);

  return (
    <PageTransition>
      <div className="w-full">
        <PageHeader title="Arquivos" className="mb-6" />

        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes">Notas</TabsTrigger>
            <TabsTrigger value="projects">Projetos</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
          </TabsList>
          <TabsContent value="notes">{renderList(notes?.data, notes?.isLoading, "notes")}</TabsContent>
          <TabsContent value="projects">{renderList(projects?.data, projects?.isLoading, "projects")}</TabsContent>
          <TabsContent value="tasks">{renderList(tasks?.data, tasks?.isLoading, "tasks")}</TabsContent>
          <TabsContent value="products">
            <div className="flex flex-col gap-3">
              <div className="relative max-w-md">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou fornecedor"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              {renderList(filteredProducts, products?.isLoading, "radar_produtos")}
            </div>
          </TabsContent>
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
