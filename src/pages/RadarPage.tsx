import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Crosshair, Plus, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import { KanbanDnD } from "@/components/radar/KanbanDnD";
import { RadarFilters, type RadarFiltersState } from "@/components/radar/RadarFilters";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { ProdutoDrawer } from "@/components/radar/ProdutoDrawer";
import { HistoricoModal } from "@/components/radar/HistoricoModal";
import { cn } from "@/lib/utils";
import type { RadarProduto } from "@/types/radar";

const FILTROS_INICIAIS: RadarFiltersState = {
  fornecedor: "all",
  decision: "all",
  stage: "all",
  busca: "",
};


export default function RadarPage() {
  const { produtos, isLoading } = useRadarProdutos();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<RadarProduto | Record<string, never> | null>(null);
  const [historicoTarget, setHistoricoTarget] = useState<RadarProduto | null>(null);
  const [filters, setFilters] = useState<RadarFiltersState>(FILTROS_INICIAIS);

  const location = useLocation();
  useEffect(() => {
    const state = location.state as
      | { preencherProduto?: Record<string, unknown>; selecionarProdutoId?: string }
      | null;
    if (state?.preencherProduto) {
      setProdutoSelecionado(state.preencherProduto as Record<string, never>);
      window.history.replaceState({}, "");
    } else if (state?.selecionarProdutoId) {
      const found = produtos.find((p) => p.id === state.selecionarProdutoId);
      if (found) {
        setProdutoSelecionado(found);
        window.history.replaceState({}, "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, produtos]);

  const produtosFiltrados = produtos.filter((p) => {
    if (p.stage === "aprovado" || p.stage === "arquivado") return false;
    if (filters.fornecedor !== "all" && p.fornecedor !== filters.fornecedor) return false;
    if (filters.decision !== "all" && p.decision !== filters.decision) return false;
    if (filters.stage !== "all" && p.stage !== filters.stage) return false;
    if (filters.busca.trim()) {
      const termo = filters.busca.toLowerCase().trim();
      const nomeBate = p.nome.toLowerCase().includes(termo);
      const fornecedorBate = p.fornecedor.toLowerCase().includes(termo);
      if (!nomeBate && !fornecedorBate) return false;
    }
    return true;

  });

  const emDecisao = produtos.filter((p) => p.stage === "decisao").length;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Crosshair className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Radar de Produtos</h1>
              {emDecisao > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {emDecisao} aguardando decisão
                </Badge>
              )}
            </div>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                Prospecção ({produtos.filter((p) => p.stage === "prospeccao").length}) ·{" "}
                Aguardando ({produtos.filter((p) => p.stage === "aguardando_custo").length}) ·{" "}
                Decisão ({emDecisao})
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltrosAbertos((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtros
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 ml-1 transition-transform",
                  filtrosAbertos && "rotate-180",
                )}
              />
            </Button>
            <Button size="sm" onClick={() => setProdutoSelecionado({})}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Filtros colapsáveis */}
        {filtrosAbertos && (
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <RadarFilters produtos={produtos} filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* Kanban */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <Skeleton className="h-5 w-32" />
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-24 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <KanbanDnD
            produtos={produtosFiltrados}
            onEdit={(p) => setProdutoSelecionado(p)}
            onHistorico={(p) => setHistoricoTarget(p)}
          />
        )}
      </div>

      <ProdutoDrawer
        produto={produtoSelecionado && "id" in produtoSelecionado ? (produtoSelecionado as RadarProduto) : null}
        open={produtoSelecionado !== null}
        onClose={() => setProdutoSelecionado(null)}
        prefill={
          produtoSelecionado && !("id" in produtoSelecionado)
            ? (produtoSelecionado as Record<string, unknown>)
            : null
        }
      />

      {historicoTarget && (
        <HistoricoModal
          produto={historicoTarget}
          open={!!historicoTarget}
          onClose={() => setHistoricoTarget(null)}
        />
      )}
    </PageTransition>
  );
}
