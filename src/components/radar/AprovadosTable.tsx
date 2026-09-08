import { useMemo, useState } from "react";
import {
  Download,
  PackageCheck,
  ShoppingCart,
  CheckCircle2,
  Archive as ArchiveIcon,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "./ScoreBadge";
import { formatCurrency } from "@/lib/radar/radarScore";
import { exportarAprovadosCSV } from "@/lib/radar/radarCSV";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { useRadarParametros } from "@/hooks/radar/useRadarParametros";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { RadarProduto } from "@/types/radar";

interface AprovadosTableProps {
  onVerProduto: (produto: RadarProduto) => void;
}

export function AprovadosTable({ onVerProduto }: AprovadosTableProps) {
  const { produtos, isLoading, atualizarStatusCompra, moverEtapa } = useRadarProdutos();
  const { parametros } = useRadarParametros();
  const [rascunhoQtd, setRascunhoQtd] = useState<Record<string, string>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const colunasExtras = (parametros.pilaresExtras ?? []).filter(
    (p) => p.ativo && p.exibirEmAprovados,
  );

  const aprovados = useMemo(
    () =>
      produtos
        .filter((p) => p.stage === "comprado" || p.stage === "aprovado")
        .sort(
          (a, b) =>
            new Date(b.stageEnteredAt).getTime() -
            new Date(a.stageEnteredAt).getTime(),
        ),
    [produtos],
  );

  const aComprar = aprovados.filter((p) => p.statusCompra === "a_comprar").length;
  const comprados = aprovados.filter((p) => p.statusCompra === "comprado").length;

  function qtdDe(produto: RadarProduto) {
    const draft = rascunhoQtd[produto.id];
    if (draft !== undefined) {
      const n = parseInt(draft.replace(/\D/g, ""), 10);
      return isNaN(n) ? 0 : n;
    }
    return produto.quantidadePedir ?? 0;
  }

  function subtotalDe(produto: RadarProduto) {
    const custo = produto.custo ?? 0;
    return custo * qtdDe(produto);
  }

  const selecionadosList = aprovados.filter((p) => selecionados.has(p.id));
  const totalCompra = selecionadosList.reduce((acc, p) => acc + subtotalDe(p), 0);
  const totalItens = selecionadosList.reduce((acc, p) => acc + qtdDe(p), 0);
  const totalGeral = aprovados.reduce((acc, p) => acc + subtotalDe(p), 0);

  const todosSelecionados =
    aprovados.length > 0 && selecionados.size === aprovados.length;

  function toggleTodos() {
    setSelecionados(
      todosSelecionados ? new Set() : new Set(aprovados.map((p) => p.id)),
    );
  }

  function toggleUm(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleStatus(produto: RadarProduto) {
    await atualizarStatusCompra({
      id: produto.id,
      statusCompra: produto.statusCompra === "a_comprar" ? "comprado" : "a_comprar",
    });
  }

  async function salvarQtd(produto: RadarProduto) {
    const draft = rascunhoQtd[produto.id];
    if (draft === undefined) return;
    const qtd = parseInt(draft.replace(/\D/g, ""), 10);
    const valor = isNaN(qtd) || qtd < 0 ? 0 : qtd;
    setRascunhoQtd((prev) => {
      const next = { ...prev };
      delete next[produto.id];
      return next;
    });
    if (valor !== (produto.quantidadePedir ?? 0)) {
      await atualizarStatusCompra({ id: produto.id, quantidadePedir: valor });
    }
  }

  async function marcarSelecionadosComprados() {
    for (const p of selecionadosList) {
      if (p.statusCompra !== "comprado") {
        await atualizarStatusCompra({ id: p.id, statusCompra: "comprado" });
      }
    }
    setSelecionados(new Set());
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (aprovados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center rounded-lg border border-dashed">
        <PackageCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-base font-medium">Nenhum produto aprovado ainda</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Produtos marcados como "Vou Comprar" no pipeline aparecem aqui
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {aComprar > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <ShoppingCart className="h-3 w-3" />A comprar: {aComprar}
            </Badge>
          )}
          {comprados > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Comprado: {comprados}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1.5 tabular-nums">
            Total geral: {formatCurrency(totalGeral)}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportarAprovadosCSV(produtos)}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={todosSelecionados}
                  onCheckedChange={toggleTodos}
                  aria-label="Selecionar todos os produtos"
                />
              </TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead>Score</TableHead>
              {colunasExtras.map((pilar) => (
                <TableHead key={pilar.id} className="text-right">
                  {pilar.label}
                </TableHead>
              ))}
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Qtd</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead>Aprovado em</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aprovados.map((produto) => {
              const selecionado = selecionados.has(produto.id);
              return (
                <TableRow
                  key={produto.id}
                  data-state={selecionado ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selecionado}
                      onCheckedChange={() => toggleUm(produto.id)}
                      aria-label={`Selecionar ${produto.nome}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium max-w-[240px]">
                    <button
                      type="button"
                      onClick={() => onVerProduto(produto)}
                      className="text-left hover:text-primary hover:underline truncate w-full"
                    >
                      {produto.nome}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {produto.fornecedor}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {produto.precoVenda != null
                      ? formatCurrency(produto.precoVenda)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {produto.custo != null ? formatCurrency(produto.custo) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {produto.margem != null ? (
                      <span
                        className={cn(
                          produto.margem >= 20
                            ? "text-success font-medium"
                            : produto.margem >= 10
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {produto.margem.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <ScoreBadge decision={produto.decision} size="sm" />
                  </TableCell>
                  {colunasExtras.map((pilar) => {
                    const v = produto.valoresCustom?.[pilar.key];
                    return (
                      <TableCell key={pilar.id} className="text-right tabular-nums">
                        {typeof v === "number"
                          ? `${v}${pilar.unidade?.suffix ?? ""}`
                          : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleStatus(produto)}
                      className="hover:opacity-80 transition-opacity"
                    >
                      {produto.statusCompra === "comprado" ? (
                        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">
                          ✓ Comprado
                        </Badge>
                      ) : (
                        <Badge variant="outline">A comprar</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={
                        rascunhoQtd[produto.id] ??
                        (produto.quantidadePedir != null
                          ? String(produto.quantidadePedir)
                          : "")
                      }
                      placeholder="0"
                      onChange={(e) =>
                        setRascunhoQtd((prev) => ({
                          ...prev,
                          [produto.id]: e.target.value,
                        }))
                      }
                      onBlur={() => salvarQtd(produto)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          setRascunhoQtd((prev) => {
                            const next = { ...prev };
                            delete next[produto.id];
                            return next;
                          });
                          e.currentTarget.blur();
                        }
                      }}
                      className="h-8 w-20 text-center text-sm tabular-nums mx-auto"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {produto.custo != null && qtdDe(produto) > 0
                      ? formatCurrency(subtotalDe(produto))
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {format(new Date(produto.stageEnteredAt), "d MMM yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Arquivar produto"
                      onClick={() =>
                        moverEtapa({
                          id: produto.id,
                          novaEtapa: "arquivado",
                          produtoAtual: produto,
                        })
                      }
                    >
                      <ArchiveIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Barra de resumo da compra */}
      {selecionadosList.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(920px,calc(100%-2rem))]">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="font-medium">
                {selecionadosList.length} produto
                {selecionadosList.length > 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {totalItens} unidade{totalItens === 1 ? "" : "s"}
              </span>
              <span className="text-base font-semibold tabular-nums">
                Total: {formatCurrency(totalCompra)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={marcarSelecionadosComprados}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marcar como comprado
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Limpar seleção"
                onClick={() => setSelecionados(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
