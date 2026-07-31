import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Sparkles, Link2, X, Loader2, RefreshCw, ArrowRight, StickyNote, CheckSquare, FolderKanban, Crosshair, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/PageTransition";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import {
  acceptSuggestion,
  dismissSuggestion,
  fetchPendingSuggestions,
  type EmbedEntityType,
  type LinkSuggestion,
} from "@/lib/api/embedding";

const TYPE_LABEL: Record<EmbedEntityType, string> = {
  note: "Nota",
  task: "Tarefa",
  project: "Projeto",
  produto: "Produto",
};

const TYPE_ICON: Record<EmbedEntityType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  task: CheckSquare,
  project: FolderKanban,
  produto: Crosshair,
};

const TYPE_ROUTE: Record<EmbedEntityType, (id: string) => string> = {
  note: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  project: (id) => `/projects/${id}`,
  produto: () => `/radar`,
};

type Titles = Record<string, string>;

async function fetchTitles(suggestions: LinkSuggestion[]): Promise<Titles> {
  const buckets: Record<EmbedEntityType, Set<string>> = {
    note: new Set(), task: new Set(), project: new Set(), produto: new Set(),
  };
  for (const s of suggestions) {
    buckets[s.source_type].add(s.source_id);
    buckets[s.target_type].add(s.target_id);
  }
  const titles: Titles = {};
  await Promise.all([
    (async () => {
      if (!buckets.note.size) return;
      const { data } = await supabase.from("notes").select("id,title").in("id", Array.from(buckets.note));
      data?.forEach((r) => (titles[`note:${r.id}`] = r.title || "(sem título)"));
    })(),
    (async () => {
      if (!buckets.task.size) return;
      const { data } = await supabase.from("tasks").select("id,title").in("id", Array.from(buckets.task));
      data?.forEach((r) => (titles[`task:${r.id}`] = r.title || "(sem título)"));
    })(),
    (async () => {
      if (!buckets.project.size) return;
      const { data } = await supabase.from("projects").select("id,title").in("id", Array.from(buckets.project));
      data?.forEach((r) => (titles[`project:${r.id}`] = r.title || "(sem título)"));
    })(),
    (async () => {
      if (!buckets.produto.size) return;
      const { data } = await supabase.from("radar_produtos").select("id,nome").in("id", Array.from(buckets.produto));
      data?.forEach((r) => (titles[`produto:${r.id}`] = r.nome || "(sem nome)"));
    })(),
  ]);
  return titles;
}

function EntityChip({ type, id, title }: { type: EmbedEntityType; id: string; title: string }) {
  const navigate = useNavigate();
  const Icon = TYPE_ICON[type];
  return (
    <Card className="min-w-0 flex-1 overflow-hidden">
      <button
        onClick={() => navigate(TYPE_ROUTE[type](id))}
        className="inline-flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors min-w-0 w-full"
      >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{TYPE_LABEL[type]}</span>
        <span className="truncate text-sm font-medium">{title}</span>
        </div>
      </button>
    </Card>
  );
}

export default function Suggestions() {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);

  const { data: suggestions = [], isLoading, refetch } = useQuery({
    queryKey: ["link-suggestions"],
    queryFn: fetchPendingSuggestions,
    staleTime: 30_000,
  });

  const { data: titles = {} } = useQuery({
    queryKey: ["link-suggestion-titles", suggestions.map((s) => s.id).join(",")],
    queryFn: () => fetchTitles(suggestions),
    enabled: suggestions.length > 0,
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("scan-link-suggestions", { body: {} });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["link-suggestions"] });
      toast.success("Varredura concluída");
    },
    onError: (e: Error) => toast.error("Erro na varredura: " + e.message),
  });

  const acceptMut = useMutation({
    mutationFn: (s: LinkSuggestion) => acceptSuggestion(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["link-suggestions"] });
      qc.invalidateQueries({ queryKey: ["entity_links"] });
      qc.invalidateQueries({ queryKey: ["radar-entity-links"] });
      toast.success("Vínculo criado");
    },
    onError: () => toast.error("Erro ao criar vínculo"),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => dismissSuggestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["link-suggestions"] }),
  });

  const acceptAllMut = useMutation({
    mutationFn: async (suggestionsToAccept: LinkSuggestion[]) => {
      const BATCH_SIZE = 10;
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < suggestionsToAccept.length; i += BATCH_SIZE) {
        const batch = suggestionsToAccept.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((s) => acceptSuggestion(s))
        );

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            successCount++;
          } else {
            failCount++;
          }
        });
      }

      return { successCount, failCount };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["link-suggestions"] });
      qc.invalidateQueries({ queryKey: ["entity_links"] });
      qc.invalidateQueries({ queryKey: ["radar-entity-links"] });

      if (result.failCount === 0) {
        toast.success(`${result.successCount} sugestões aceitas`);
      } else {
        toast.error(
          `${result.successCount} aceitas, ${result.failCount} falharam`,
          { description: "As sugestões que falharam continuam na lista." }
        );
      }
    },
    onError: (error) => {
      console.error("Erro ao aceitar todas:", error);
      toast.error("Erro ao processar sugestões");
    },
  });

  return (
    <PageTransition>
      <div className="flex flex-col gap-6 max-w-4xl">
        <PageHeader
          title="Sugestões da IA"
          icon={Sparkles}
          description="A IA encontrou possíveis vínculos entre seus itens. Aceite os que fizerem sentido."
          actions={
            <div className="flex items-center gap-2">
              {suggestions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={acceptingAll || acceptMut.isPending || dismissMut.isPending}
                >
                  {acceptingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aceitando...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Aceitar todos
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => scanMut.mutate()}
                disabled={scanMut.isPending}
              >
                {scanMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Procurar agora
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 flex-1" />
                </div>
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhuma sugestão no momento</p>
            <p className="text-sm mt-1">
              Conforme você cria notas, tarefas, projetos e produtos, a IA identifica relações automaticamente.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {suggestions.map((s) => {
              const srcTitle = titles[`${s.source_type}:${s.source_id}`] || "…";
              const tgtTitle = titles[`${s.target_type}:${s.target_id}`] || "…";
              return (
                <Card key={s.id} className="p-4 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <EntityChip type={s.source_type} id={s.source_id} title={srcTitle} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground self-center shrink-0 hidden sm:block" />
                    <EntityChip type={s.target_type} id={s.target_id} title={tgtTitle} />
                  </div>
                  {s.reason && (
                    <p className="text-sm text-muted-foreground italic">"{s.reason}"</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Confiança {Math.round(Number(s.score) * 100)}%
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissMut.mutate(s.id)}
                        disabled={dismissMut.isPending}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Ignorar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => acceptMut.mutate(s)}
                        disabled={acceptMut.isPending}
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        Vincular
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aceitar todas as sugestões?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso criará vínculos para {suggestions.length} sugestão{ suggestions.length !== 1 ? "ões" : "" } pendente{ suggestions.length !== 1 ? "s" : "" }.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setAcceptingAll(true);
                acceptAllMut.mutate(suggestions, {
                  onSettled: () => setAcceptingAll(false),
                });
              }}
              disabled={acceptAllMut.isPending}
            >
              {acceptAllMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aceitando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
