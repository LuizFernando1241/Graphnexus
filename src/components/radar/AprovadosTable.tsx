import { useState } from "react";
import { Download, PackageCheck, ShoppingCart, CheckCircle2, Archive as ArchiveIcon } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "./ScoreBadge";
import { formatCurrency } from "@/lib/radar/radarScore";
import { exportarAprovadosCSV } from "@/lib/radar/radarCSV";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { RadarProduto } from "@/types/radar";

interface AprovadosTableProps {
  onVerProduto: (produto: RadarProduto) => void;
}

export function AprovadosTable({ onVerProduto }: AprovadosTableProps) {
  const { produtos, isLoading, atualizarStatusCompra, moverEtapa } = useRadarProdutos();
  const [editandoQtd, setEditandoQtd] = useState<string | null>(null);
  const [qtdTemp, setQtdTemp] = useState("");

  const aprovados = produtos
    .filter((p) => p.stage === "aprovado")
    .sort(
      (a, b) =>
        new Date(b.stageEnteredAt).getTime() -
        new Date(a.stageEnteredAt).getTime(),
    );

  const aComprar = aprovados.filter((p) => p.statusCompra === "a_comprar").length;
  const comprados = aprovados.filter((p) => p.statusCompra === "comprado").length;

  async function toggleStatus(produto: RadarProduto) {
    await atualizarStatusCompra({
      id: produto.id,
      statusCompra: produto.statusCompra === "a_comprar" ? "comprado" : "a_comprar",
    });
  }

  async function salvarQtd(produto: RadarProduto) {
    const qtd = parseInt(qtdTemp, 10);
    if (!isNaN(qtd) && qtd >= 0) {
      await atualizarStatusCompra({ id: produto.id, quantidadePedir: qtd });
    }
    setEditandoQtd(null);
    setQtdTemp("");
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
    <div className="flex flex-col gap-4">
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
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Qtd</TableHead>
              <TableHead>Aprovado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aprovados.map((produto) => (
              <TableRow key={produto.id}>
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
                          ? "text-emerald-600 font-medium"
                          : produto.margem >= 10
                            ? "text-amber-600"
                            : "text-red-500",
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
                <TableCell>
                  <button
                    type="button"
                    onClick={() => toggleStatus(produto)}
                    className="hover:opacity-80 transition-opacity"
                  >
                    {produto.statusCompra === "comprado" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                        ✓ Comprado
                      </Badge>
                    ) : (
                      <Badge variant="outline">A comprar</Badge>
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  {editandoQtd === produto.id ? (
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={qtdTemp}
                      onChange={(e) => setQtdTemp(e.target.value)}
                      onBlur={() => salvarQtd(produto)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") salvarQtd(produto);
                        if (e.key === "Escape") {
                          setEditandoQtd(null);
                          setQtdTemp("");
                        }
                      }}
                      className="h-7 w-16 text-center text-xs"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoQtd(produto.id);
                        setQtdTemp(
                          produto.quantidadePedir != null
                            ? String(produto.quantidadePedir)
                            : "",
                        );
                      }}
                      className="inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-md hover:bg-muted text-sm tabular-nums"
                    >
                      {produto.quantidadePedir != null ? (
                        produto.quantidadePedir
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {format(new Date(produto.stageEnteredAt), "d MMM yyyy", {
                    locale: ptBR,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
