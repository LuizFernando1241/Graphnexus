import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Crosshair, Plus, SlidersHorizontal, ChevronDown, Maximize2, Minimize2, Filter, FileText, Settings, CheckSquare2, X, Download, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import { PageHeader } from "@/components/PageHeader";
import { KanbanDnD } from "@/components/radar/KanbanDnD";
import { RadarFilters, type RadarFiltersState } from "@/components/radar/RadarFilters";
import { AdvancedFilters } from "@/components/radar/AdvancedFilters";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { useRadarPreferences } from "@/hooks/radar/useRadarPreferences";
import { ProdutoSheet } from "@/components/radar/ProdutoSheet";
import { HistoricoModal } from "@/components/radar/HistoricoModal";
import { AprovadosTable } from "@/components/radar/AprovadosTable";
import { OrcamentoDialog } from "@/components/radar/OrcamentoDialog";
import { ExportFieldsDialog } from "@/components/radar/ExportFieldsDialog";
import { STAGE_SOLID, STAGE_CHIP_ACTIVE } from "@/lib/radar/decisionColors";
import { buildExportFields, type ExportField } from "@/lib/radar/radarExportFields";
import { calcularScore } from "@/lib/radar/radarScore";
import { useRadarParametros } from "@/hooks/radar/useRadarParametros";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RadarProduto, PipelineStage } from "@/types/radar";

const FILTROS_INICIAIS: RadarFiltersState = {
  fornecedor: "all",
  decision: "all",
  stage: "all",
  busca: "",
};

const STAGE_CHIPS: { stage: PipelineStage; label: string }[] = [
  { stage: "prospeccao", label: "Prospecção" },
  { stage: "aguardando_custo", label: "Aguardando" },
  { stage: "aguardando_decisao", label: "Aguardando Decisão" },
  { stage: "decisao", label: "Decisão" },
];



export default function RadarPage() {
  const navigate = useNavigate();
  const { produtos, isLoading } = useRadarProdutos();
  const { preferences, setColumnSort, removeColumnSort, setAdvancedFilters, clearAdvancedFilters } = useRadarPreferences();
  const { parametros } = useRadarParametros();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<RadarProduto | Record<string, never> | null>(null);
  const [historicoTarget, setHistoricoTarget] = useState<RadarProduto | null>(null);
  const [filters, setFilters] = useState<RadarFiltersState>(FILTROS_INICIAIS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [decisionFilter, setDecisionFilter] = useState<"todos" | "aprovado" | "reprovado">("todos");
  const [orcamentoAberto, setOrcamentoAberto] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function openExportDialog() {
    setExportDialogOpen(true);
  }

  function handleExport(selectedFieldIds: string[]) {
    const selectedProdutos = produtosFiltrados.filter((p) => selectedIds.has(p.id));
    if (selectedProdutos.length === 0) {
      toast.error("Nenhum produto selecionado para exportação");
      return;
    }

    // Usar o primeiro produto para determinar os campos disponíveis (incluindo pilares customizados)
    const sampleProduto = selectedProdutos[0];
    const allFields = buildExportFields(sampleProduto, parametros);
    const selectedFields = allFields.filter((f) => selectedFieldIds.includes(f.id));

    if (selectedFields.length === 0) {
      toast.error("Nenhum campo selecionado para exportação");
      return;
    }

    // Importar xlsx dinamicamente
    import("xlsx").then((XLSX) => {
      // Montar dados para Excel
      const headers = selectedFields.map((f) => f.label);
      const rows = selectedProdutos.map((produto) => {
        const scoreResult = calcularScore(produto, parametros);
        return selectedFields.map((field) => field.getValue(produto, scoreResult.pilares));
      });

      // Criar worksheet
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");

      // Gerar nome do arquivo
      const date = new Date().toISOString().split("T")[0];
      const filename = `radar-export-${date}.xlsx`;

      // Salvar arquivo
      XLSX.writeFile(workbook, filename);

      // Feedback e limpeza
      toast.success(`${selectedProdutos.length} produto${selectedProdutos.length !== 1 ? "s" : ""} exportado${selectedProdutos.length !== 1 ? "s" : ""}`);
      exitSelectionMode();
    }).catch((error) => {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar arquivo Excel");
    });
  }

  const emDecisao = produtos.filter((p) => p.stage === "aguardando_decisao").length;
  const totalComprados = produtos.filter((p) => p.stage === "comprado" || p.stage === "aprovado").length;
  const tab: "pipeline" | "comprados" =
    location.pathname === "/radar/aprovados" ? "comprados" : "pipeline";

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <PageHeader
          title="Radar de Produtos"
          icon={Crosshair}
          badge={
            emDecisao > 0 ? (
              <Badge variant="destructive">{emDecisao} aguardando decisão</Badge>
            ) : null
          }
          actions={
            tab === "comprados" ? (
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings?tab=radar")} title="Parâmetros do Radar">
                <Settings className="h-4 w-4" />
              </Button>
            ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings?tab=radar")} title="Parâmetros do Radar">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOrcamentoAberto(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Solicitar orçamento
              </Button>
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
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (selectionMode) exitSelectionMode();
                  else setSelectionMode(true);
                }}
              >
                <CheckSquare2 className="h-4 w-4 mr-2" />
                {selectionMode ? "Cancelar seleção" : "Selecionar produtos"}
              </Button>
            </>
            )
          }
        >
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => navigate("/radar")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === "pipeline" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Pipeline
              </button>
              <button
                type="button"
                onClick={() => navigate("/radar/aprovados")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === "comprados" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Comprados
                {totalComprados > 0 && (
                  <span className="tabular-nums font-semibold">{totalComprados}</span>
                )}
              </button>
            </div>
          </div>

          {tab === "pipeline" && !isLoading && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {STAGE_CHIPS.map(({ stage, label }) => {
                const count = produtos.filter((p) => p.stage === stage).length;
                const active = filters.stage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({ ...f, stage: f.stage === stage ? "all" : stage }))
                    }
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                      active ? STAGE_CHIP_ACTIVE[stage] : "border-border hover:bg-accent",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", STAGE_SOLID[stage])} />
                    {label} <span className="tabular-nums font-semibold">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </PageHeader>



        {tab === "comprados" ? (
          <AprovadosTable onVerProduto={(p) => setProdutoSelecionado(p)} />
        ) : (
          <>
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
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
          />
        )}
          </>
        )}
      </div>

      <ProdutoSheet
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

      <OrcamentoDialog open={orcamentoAberto} onOpenChange={setOrcamentoAberto} produtos={produtos} />

      <ExportFieldsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        fields={selectedIds.size > 0 ? buildExportFields(produtosFiltrados[0], parametros) : []}
        onExport={handleExport}
      />

      {/* Barra de ações flutuante durante seleção */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedIds.size} produto{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="text-xs"
          >
            {selectedIds.size === visibleIds.length ? "Limpar seleção" : "Selecionar todos"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitSelectionMode}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={openExportDialog}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Exportar selecionados
          </Button>
        </div>
      )}
    </PageTransition>
  );
}
