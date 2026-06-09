import { useState, useMemo, useEffect } from "react";
import { Clock, ExternalLink, AlertTriangle, Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Badge } from "@/components/ui/badge";
import { ScorePainel } from "./ScorePainel";
import { HistoricoModal } from "./HistoricoModal";
import { PainelConexoes } from "./PainelConexoes";
import {
  calcularScore,
  getStageLabel,
  formatCurrency,
} from "@/lib/radar/radarScore";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { useRadarParametros } from "@/hooks/radar/useRadarParametros";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RadarProduto, RadarProdutoFormData } from "@/types/radar";

interface ProdutoDrawerProps {
  produto: RadarProduto | null;
  open: boolean;
  onClose: () => void;
  prefill?: Partial<RadarProdutoFormData> | null;
}

const EMPTY_FORM: RadarProdutoFormData = {
  nome: "",
  fornecedor: "",
  linkML: "",
  precoVenda: undefined,
  custo: undefined,
  margem: undefined,
  visitasMes: undefined,
  vendasMes: undefined,
  concorrentesFull: undefined,
  isLancamento: false,
  observacoes: "",
};

function parseNum(value: string): number | undefined {
  if (!value || value.trim() === "") return undefined;
  // Aceita vírgula ou ponto como decimal; remove separadores de milhar.
  let s = value.trim().replace(/\s/g, "");
  const hasComma = s.includes(",");
  if (hasComma) {
    // Ex: "1.200,50" -> "1200.50"
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Sem vírgula: assumir que ponto é decimal (ex: "299.90")
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

function parseInteiro(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const limpo = value.replace(/[^\d-]/g, "");
  const n = parseInt(limpo, 10);
  return isNaN(n) ? undefined : n;
}


export function ProdutoDrawer({ produto, open, onClose, prefill }: ProdutoDrawerProps) {
  const isNovo = !produto?.id;
  const {
    produtos,
    criarProduto,
    atualizarProduto,
    moverEtapa,
    deletarProduto,
    isCriando,
    isAtualizando,
    isDeletando,
  } = useRadarProdutos();
  const { parametros } = useRadarParametros();


  const [form, setForm] = useState<RadarProdutoFormData>(EMPTY_FORM);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showDuplicataDialog, setShowDuplicataDialog] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (produto?.id) {
      setForm({
        nome: produto.nome,
        fornecedor: produto.fornecedor,
        linkML: produto.linkML ?? "",
        precoVenda: produto.precoVenda,
        custo: produto.custo,
        margem: produto.margem,
        visitasMes: produto.visitasMes,
        vendasMes: produto.vendasMes,
        concorrentesFull: produto.concorrentesFull,
        isLancamento: produto.isLancamento,
        observacoes: produto.observacoes ?? "",
      });
    } else {
      setForm({ ...EMPTY_FORM, ...(prefill ?? {}) });
    }
  }, [open, produto, prefill]);

  const scoreResult = useMemo(
    () => calcularScore(form, parametros),
    [form, parametros],
  );

  const faturamentoEstimado = useMemo(() => {
    if (form.vendasMes != null && form.precoVenda != null) {
      return form.vendasMes * form.precoVenda;
    }
    return null;
  }, [form.vendasMes, form.precoVenda]);

  const vendasMaioresQueVisitas =
    form.vendasMes != null &&
    form.visitasMes != null &&
    form.vendasMes > form.visitasMes;

  const zeroConcorrentes = form.concorrentesFull === 0;

  const fornecedoresExistentes = Array.from(
    new Set(produtos.map((p) => p.fornecedor)),
  ).sort();

  function verificarDuplicata(): boolean {
    if (!isNovo) return false;
    return produtos.some(
      (p) =>
        p.nome.toLowerCase().trim() === form.nome.toLowerCase().trim() &&
        p.fornecedor.toLowerCase().trim() === form.fornecedor.toLowerCase().trim(),
    );
  }

  async function handleSalvar() {
    if (!form.nome.trim() || !form.fornecedor.trim()) return;
    if (verificarDuplicata()) {
      setShowDuplicataDialog(true);
      return;
    }
    await executarSalvar();
  }

  async function executarSalvar() {
    setSalvando(true);
    try {
      if (isNovo) {
        await criarProduto(form);
      } else {
        await atualizarProduto({
          id: produto!.id,
          formData: form,
          produtoAtual: produto!,
        });
      }
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  function setField<K extends keyof RadarProdutoFormData>(
    key: K,
    value: RadarProdutoFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isBusy = salvando || isCriando || isAtualizando;
  const podeSalvar =
    form.nome.trim().length > 0 &&
    form.fornecedor.trim().length > 0 &&
    !isBusy;

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="flex flex-col gap-1 min-w-0">
                <SheetTitle className="truncate">
                  {isNovo ? "Novo Produto" : form.nome || "Editar Produto"}
                </SheetTitle>
                {!isNovo && produto && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {getStageLabel(produto.stage)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Editado{" "}
                      {formatDistanceToNow(new Date(produto.updatedAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>
              {!isNovo && produto && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setShowHistorico(true)}
                  title="Ver histórico"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="px-5 py-3 flex-shrink-0">
            <ScorePainel scoreResult={scoreResult} />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <Tabs defaultValue="produto" className="w-full">
              <TabsList className={isNovo ? "grid grid-cols-3 w-full" : "grid grid-cols-4 w-full"}>
                {(isNovo
                  ? (["produto", "mercado", "notas"] as const)
                  : (["produto", "mercado", "notas", "conexoes"] as const)
                ).map((aba) => (
                  <TabsTrigger key={aba} value={aba} className="capitalize">
                    {aba === "produto"
                      ? "Produto"
                      : aba === "mercado"
                        ? "Mercado"
                        : aba === "notas"
                          ? "Notas"
                          : "Conexões"}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ── Aba Produto ── */}
              <TabsContent value="produto" className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-nome">Nome do produto *</Label>
                  <Input
                    id="rd-nome"
                    value={form.nome}
                    onChange={(e) => setField("nome", e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-fornecedor">Fornecedor *</Label>
                  <Input
                    id="rd-fornecedor"
                    value={form.fornecedor}
                    onChange={(e) => setField("fornecedor", e.target.value)}
                    list="fornecedores-list"
                    maxLength={200}
                  />
                  <datalist id="fornecedores-list">
                    {fornecedoresExistentes.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-link">Link do anúncio no ML</Label>
                  <div className="relative">
                    <Input
                      id="rd-link"
                      type="url"
                      value={form.linkML ?? ""}
                      onChange={(e) => setField("linkML", e.target.value)}
                      className="pr-9"
                    />
                    {form.linkML && (
                      <a
                        href={form.linkML}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rd-preco">Preço de venda (R$)</Label>
                    <Input
                      id="rd-preco"
                      inputMode="decimal"
                      value={form.precoVenda ?? ""}
                      onChange={(e) =>
                        setField("precoVenda", parseNum(e.target.value))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="rd-custo" className="flex items-center gap-1">
                      Custo (R$)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground cursor-help text-[10px]">
                            ⓘ
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Apenas para controle interno. Não afeta o score.
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id="rd-custo"
                      inputMode="decimal"
                      value={form.custo ?? ""}
                      onChange={(e) =>
                        setField("custo", parseNum(e.target.value))
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ── Aba Mercado ── */}
              <TabsContent value="mercado" className="flex flex-col gap-4 mt-4">
                {vendasMaioresQueVisitas && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Vendas maiores que visitas — verifique os dados
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-margem">Margem de lucro (%)</Label>
                  <div className="relative">
                    <Input
                      id="rd-margem"
                      inputMode="decimal"
                      value={form.margem ?? ""}
                      onChange={(e) =>
                        setField("margem", parseNum(e.target.value))
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Calcule por fora e informe aqui. Score funciona sem margem
                    (4 pilares).
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-visitas">Visitas por mês</Label>
                  <Input
                    id="rd-visitas"
                    inputMode="numeric"
                    value={form.visitasMes ?? ""}
                    onChange={(e) =>
                      setField("visitasMes", parseNum(e.target.value))
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-vendas">Vendas por mês</Label>
                  <Input
                    id="rd-vendas"
                    inputMode="numeric"
                    value={form.vendasMes ?? ""}
                    onChange={(e) =>
                      setField("vendasMes", parseNum(e.target.value))
                    }
                  />
                  {faturamentoEstimado != null && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">
                        Faturamento estimado:
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(faturamentoEstimado)}/mês
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="rd-concorrentes"
                    className="flex items-center gap-1.5"
                  >
                    Concorrentes no Full
                    {zeroConcorrentes && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-amber-500 cursor-help">⚠️</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Nenhum concorrente no Full. Verifique se há demanda
                          real antes de avançar.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <Input
                    id="rd-concorrentes"
                    inputMode="numeric"
                    value={form.concorrentesFull ?? ""}
                    onChange={(e) =>
                      setField("concorrentesFull", parseInteiro(e.target.value))
                    }
                  />
                  {zeroConcorrentes && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Oportunidade excepcional (15 pts) — confirme se há
                      demanda.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="rd-lancamento"
                      className="cursor-pointer"
                    >
                      É lançamento?
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      O pilar de demanda será ignorado no cálculo
                    </p>
                  </div>
                  <Switch
                    id="rd-lancamento"
                    checked={form.isLancamento}
                    onCheckedChange={(v) => setField("isLancamento", v)}
                  />
                </div>
              </TabsContent>

              {/* ── Aba Notas ── */}
              <TabsContent value="notas" className="flex flex-col gap-2 mt-4">
                <Label htmlFor="rd-obs">Observações</Label>
                <Textarea
                  id="rd-obs"
                  value={form.observacoes ?? ""}
                  onChange={(e) => setField("observacoes", e.target.value)}
                  className="min-h-[200px] resize-none"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {(form.observacoes ?? "").length}/2000
                </p>
              </TabsContent>

              {/* ── Aba Conexões ── */}
              {!isNovo && produto && (
                <TabsContent value="conexoes" className="mt-4">
                  <PainelConexoes produto={produto} />
                </TabsContent>
              )}
            </Tabs>
          </div>

          <div className="px-5 py-4 border-t flex items-center justify-between gap-3 flex-shrink-0 bg-background">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={!podeSalvar}
              className="min-w-24"
            >
              {isBusy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={showDuplicataDialog}
        onOpenChange={setShowDuplicataDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produto duplicado</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um produto com o nome{" "}
              <strong>"{form.nome}"</strong> do fornecedor{" "}
              <strong>"{form.fornecedor}"</strong>. Deseja salvar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executarSalvar}>
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {produto?.id && (
        <HistoricoModal
          produto={produto}
          open={showHistorico}
          onClose={() => setShowHistorico(false)}
        />
      )}
    </TooltipProvider>
  );
}
