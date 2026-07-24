import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Crosshair, Plus, SlidersHorizontal, ChevronDown, Maximize2, Minimize2, Filter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import { KanbanDnD } from "@/components/radar/KanbanDnD";
import { RadarFilters, type RadarFiltersState } from "@/components/radar/RadarFilters";
import { AdvancedFilters } from "@/components/radar/AdvancedFilters";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { useRadarPreferences } from "@/hooks/radar/useRadarPreferences";
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
  const { preferences, setColumnSort, removeColumnSort, setAdvancedFilters, clearAdvancedFilters } = useRadarPreferences();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<RadarProduto | Record<string, never> | null>(null);
  const [historicoTarget, setHistoricoTarget] = useState<RadarProduto | null>(null);
  const [filters, setFilters] = useState<RadarFiltersState>(FILTROS_INICIAIS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [decisionFilter, setDecisionFilter] = useState<"todos" | "aprovado" | "reprovado">("todos");

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

  const STAGES_KANBAN = ["prospeccao", "aguardando_custo", "aguardando_decisao", "decisao"] as const;

  // Aplicar filtros básicos + filtros avançados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (!(STAGES_KANBAN as readonly string[]).includes(p.stage)) return false;
      if (filters.fornecedor !== "all" && p.fornecedor !== filters.fornecedor) return false;
      if (filters.decision !== "all" && p.decision !== filters.decision) return false;
      if (filters.stage !== "all" && p.stage !== filters.stage) return false;
      if (filters.busca.trim()) {
        const termo = filters.busca.toLowerCase().trim();
        const nomeBate = p.nome.toLowerCase().includes(termo);
        const fornecedorBate = p.fornecedor.toLowerCase().includes(termo);
        if (!nomeBate && !fornecedorBate) return false;
      }

      // Filtros avançados
      const adv = preferences.advancedFilters;
      if (adv.scoreMin !== undefined && p.scoreTotal < adv.scoreMin) return false;
      if (adv.scoreMax !== undefined && p.scoreTotal > adv.scoreMax) return false;
      if (adv.decision !== undefined && adv.decision !== "all" && p.decision !== adv.decision) return false;
      if (adv.fornecedor !== undefined && p.fornecedor !== adv.fornecedor) return false;
      if (adv.margemMin !== undefined && (p.margem ?? 0) < adv.margemMin) return false;
      if (adv.margemMax !== undefined && (p.margem ?? 0) > adv.margemMax) return false;
      if (adv.ticketMin !== undefined && (p.precoVenda ?? 0) < adv.ticketMin) return false;
      if (adv.ticketMax !== undefined && (p.precoVenda ?? 0) > adv.ticketMax) return false;

      return true;
    });
  }, [produtos, filters, preferences.advancedFilters]);

  const visibleIds = useMemo(
    () => produtosFiltrados.map((p) => p.id),
    [produtosFiltrados],
  );
  const allExpanded =
    visibleIds.length > 0 && visibleIds.every((id) => expandedIds.has(id));

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleExpandAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(visibleIds));
  }

  const emDecisao = produtos.filter((p) => p.stage === "aguardando_decisao").length;

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
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, stage: f.stage === "prospeccao" ? "all" : "prospeccao" }))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    filters.stage === "prospeccao" ? "border-blue-400/60 bg-blue-400/10 text-foreground" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  Prospecção <span className="tabular-nums font-semibold">{produtos.filter((p) => p.stage === "prospeccao").length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, stage: f.stage === "aguardando_custo" ? "all" : "aguardando_custo" }))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    filters.stage === "aguardando_custo" ? "border-amber-400/60 bg-amber-400/10 text-foreground" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Aguardando <span className="tabular-nums font-semibold">{produtos.filter((p) => p.stage === "aguardando_custo").length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, stage: f.stage === "aguardando_decisao" ? "all" : "aguardando_decisao" }))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    filters.stage === "aguardando_decisao" ? "border-violet-400/60 bg-violet-400/10 text-foreground" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                  Aguardando Decisão <span className="tabular-nums font-semibold">{emDecisao}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, stage: f.stage === "decisao" ? "all" : "decisao" }))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    filters.stage === "decisao" ? "border-emerald-400/60 bg-emerald-400/10 text-foreground" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Decisão <span className="tabular-nums font-semibold">{produtos.filter((p) => p.stage === "decisao").length}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleExpandAll} disabled={visibleIds.length === 0}>
              {allExpanded ? (
                <><Minimize2 className="h-4 w-4 mr-2" />Recolher todos</>
              ) : (
                <><Maximize2 className="h-4 w-4 mr-2" />Expandir todos</>
              )}
            </Button>
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
            <Button variant="outline" size="sm" onClick={() => setFiltrosAvancadosAbertos((v) => !v)}>
              <Filter className="h-4 w-4 mr-2" />
              Avançados
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 ml-1 transition-transform",
                  filtrosAvancadosAbertos && "rotate-180",
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
          <div className="rounded-lg border border-border bg-card/40 p-4">
            <RadarFilters produtos={produtos} filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* Filtros avançados colapsáveis */}
        {filtrosAvancadosAbertos && (
          <AdvancedFilters
            filters={preferences.advancedFilters}
            onChange={setAdvancedFilters}
            onClear={clearAdvancedFilters}
            produtos={produtos}
            visibleCount={produtosFiltrados.length}
            totalCount={produtos.length}
          />
        )}

        {/* Kanban */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
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
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            decisionFilter={decisionFilter}
            onChangeDecisionFilter={setDecisionFilter}
            columnSorts={preferences.columnSorts}
            onSortChange={setColumnSort}
            onSortClear={removeColumnSort}
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
