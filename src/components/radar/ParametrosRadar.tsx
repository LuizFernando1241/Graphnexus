import { useState, useEffect } from "react";
import { Save, RotateCcw, AlertCircle, CheckCircle2, RefreshCw, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRadarParametros } from "@/hooks/radar/useRadarParametros";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { DEFAULT_PARAMETROS, DEFAULT_FAIXAS, RESERVED_VAR_KEYS } from "@/lib/radar/radarScore";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  RadarParametros,
  RadarWeights,
  RadarFaixas,
  FaixaItem,
  PilarExtra,
  RegraDescarteCustom,
  OperadorDescarte,
} from "@/types/radar";

const PILAR_UNIT: Record<keyof RadarFaixas, { prefix?: string; suffix?: string; direcao: "min" | "max" }> = {
  margem: { suffix: "%", direcao: "min" },
  ticket: { prefix: "R$", direcao: "min" },
  demanda: { prefix: "R$", suffix: "/mês", direcao: "min" },
  visitas: { suffix: "visitas", direcao: "min" },
  concorrentes: { suffix: "concorrentes", direcao: "max" },
};

const PILAR_FAIXA_LABELS: Record<keyof RadarFaixas, string> = {
  margem: "Margem de Lucro (%)",
  ticket: "Ticket Médio (R$)",
  demanda: "Demanda / Faturamento (R$/mês)",
  visitas: "Visitas por Mês",
  concorrentes: "Concorrentes no Full",
};

const PILAR_LABELS: Record<keyof RadarWeights, string> = {
  margem: "Margem de Lucro",
  ticket: "Ticket Médio",
  demanda: "Demanda / Faturamento",
  visitas: "Visitas por Mês",
  concorrentes: "Concorrentes no Full",
};

const DECISION_ROWS = [
  { key: "cautela", label: "⚠️ Cautela", cor: "text-amber-600" },
  { key: "viavel", label: "✅ Viável", cor: "text-emerald-600" },
  { key: "excelente", label: "🚀 Excelente", cor: "text-violet-600" },
] as const;

export function ParametrosRadar() {
  const { parametros, saveParametros, isLoading, isSaving } = useRadarParametros();
  const { recalcularTodos, isRecalculando } = useRadarProdutos();
  const [local, setLocal] = useState<RadarParametros>(DEFAULT_PARAMETROS);
  const [isDirty, setIsDirty] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);

  useEffect(() => {
    if (!isLoading && parametros) {
      setLocal(parametros);
      setIsDirty(false);
    }
  }, [parametros, isLoading]);

  const somaWeights = Object.values(local.weights).reduce((a, b) => a + b, 0);
  const pesoValido = Math.abs(somaWeights - 100) < 0.5;

  // Validação de chaves de pilares customizados: não podem colidir com variáveis
  // canônicas (precoVenda, faturamento, etc.) nem duplicar entre si.
  const RESERVED_SET = new Set<string>(RESERVED_VAR_KEYS as readonly string[]);
  const pilarKeyErrors: Record<string, string> = {};
  {
    const seen = new Map<string, string>(); // key -> first pilar id
    for (const p of local.pilaresExtras ?? []) {
      const k = (p.key ?? "").trim();
      if (!k) {
        pilarKeyErrors[p.id] = "Chave obrigatória.";
        continue;
      }
      if (RESERVED_SET.has(k)) {
        pilarKeyErrors[p.id] = `"${k}" é uma variável reservada do sistema.`;
        continue;
      }
      if (seen.has(k)) {
        pilarKeyErrors[p.id] = `Chave "${k}" duplicada.`;
        continue;
      }
      seen.set(k, p.id);
    }
  }
  const chavesValidas = Object.keys(pilarKeyErrors).length === 0;

  function setWeight(key: keyof RadarWeights, value: number) {
    setLocal((prev) => ({
      ...prev,
      weights: { ...prev.weights, [key]: Math.max(0, Math.min(100, value)) },
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function setThreshold(
    key: keyof typeof local.decisaoThresholds,
    value: number,
  ) {
    setLocal((prev) => ({
      ...prev,
      decisaoThresholds: { ...prev.decisaoThresholds, [key]: value },
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function setAutoDescarte(
    key: keyof typeof local.autoDescarte,
    value: number,
  ) {
    setLocal((prev) => ({
      ...prev,
      autoDescarte: { ...prev.autoDescarte, [key]: value },
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function setFaixaCampo(
    pilar: keyof RadarFaixas,
    index: number,
    campo: "limiteMin" | "limiteMax" | "pontos",
    value: number,
  ) {
    setLocal((prev) => {
      const atual = (prev.faixas?.[pilar] ?? DEFAULT_FAIXAS[pilar]).map((f, i) =>
        i === index ? { ...f, [campo]: value } : f,
      );
      return { ...prev, faixas: { ...prev.faixas, [pilar]: atual } };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  function toggleFaixaFlag(
    pilar: keyof RadarFaixas,
    index: number,
    campo: "escalaAberta" | "descarte",
  ) {
    setLocal((prev) => {
      const atual = (prev.faixas?.[pilar] ?? DEFAULT_FAIXAS[pilar]).map((f, i) =>
        i === index ? { ...f, [campo]: !f[campo] } : f,
      );
      return { ...prev, faixas: { ...prev.faixas, [pilar]: atual } };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  function addFaixa(pilar: keyof RadarFaixas) {
    setLocal((prev) => {
      const atual = prev.faixas?.[pilar] ?? DEFAULT_FAIXAS[pilar];
      const nova: FaixaItem =
        PILAR_UNIT[pilar].direcao === "min"
          ? { limiteMin: 0, pontos: 0 }
          : { limiteMax: 0, pontos: 0 };
      return {
        ...prev,
        faixas: { ...prev.faixas, [pilar]: [...atual, nova] },
      };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  function removeFaixa(pilar: keyof RadarFaixas, index: number) {
    setLocal((prev) => {
      const atual = (prev.faixas?.[pilar] ?? DEFAULT_FAIXAS[pilar]).filter(
        (_, i) => i !== index,
      );
      return { ...prev, faixas: { ...prev.faixas, [pilar]: atual } };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  function resetFaixaPilar(pilar: keyof RadarFaixas) {
    setLocal((prev) => ({
      ...prev,
      faixas: { ...prev.faixas, [pilar]: DEFAULT_FAIXAS[pilar] },
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  // ── Visibilidade de pilares built-in ──
  function togglePilarVisivel(key: keyof RadarWeights) {
    setLocal((prev) => {
      const vis = { ...(prev.pilaresVisibilidade ?? {}) };
      const atual = vis[key] !== false; // default visível
      vis[key] = !atual;
      return { ...prev, pilaresVisibilidade: vis };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  // ── Pilares personalizados ──
  function addPilarExtra() {
    setLocal((prev) => {
      const extras = [...(prev.pilaresExtras ?? [])];
      const idx = extras.length + 1;
      const novo: PilarExtra = {
        id: crypto.randomUUID(),
        key: `custom_${idx}`,
        label: `Pilar personalizado ${idx}`,
        tipo: "numero",
        peso: 10,
        direcao: "max",
        ativo: true,
        exibirEmAprovados: false,
        faixas: [
          { limiteMin: 0, pontos: 0 },
          { limiteMin: 10, pontos: 5 },
          { limiteMin: 50, pontos: 10, escalaAberta: true },
        ],
      };
      extras.push(novo);
      return { ...prev, pilaresExtras: extras };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  function updatePilarExtra(id: string, patch: Partial<PilarExtra>) {
    setLocal((prev) => ({
      ...prev,
      pilaresExtras: (prev.pilaresExtras ?? []).map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function removePilarExtra(id: string) {
    setLocal((prev) => ({
      ...prev,
      pilaresExtras: (prev.pilaresExtras ?? []).filter((p) => p.id !== id),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function setFaixaExtra(pilarId: string, index: number, patch: Partial<FaixaItem>) {
    setLocal((prev) => ({
      ...prev,
      pilaresExtras: (prev.pilaresExtras ?? []).map((p) =>
        p.id === pilarId
          ? { ...p, faixas: p.faixas.map((f, i) => (i === index ? { ...f, ...patch } : f)) }
          : p,
      ),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function addFaixaExtra(pilarId: string) {
    setLocal((prev) => ({
      ...prev,
      pilaresExtras: (prev.pilaresExtras ?? []).map((p) =>
        p.id === pilarId
          ? { ...p, faixas: [...p.faixas, { limiteMin: 0, pontos: 0 }] }
          : p,
      ),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function removeFaixaExtra(pilarId: string, index: number) {
    setLocal((prev) => ({
      ...prev,
      pilaresExtras: (prev.pilaresExtras ?? []).map((p) =>
        p.id === pilarId
          ? { ...p, faixas: p.faixas.filter((_, i) => i !== index) }
          : p,
      ),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  // ── Descartes personalizados ──
  function addDescarteExtra() {
    setLocal((prev) => {
      const novo: RegraDescarteCustom = {
        id: crypto.randomUUID(),
        campo: "precoVenda",
        operador: "<",
        valor: 0,
        motivo: "Nova regra de descarte",
        ativo: true,
      };
      return { ...prev, descartesExtras: [...(prev.descartesExtras ?? []), novo] };
    });
    setIsDirty(true);
    setSalvoOk(false);
  }

  function updateDescarteExtra(id: string, patch: Partial<RegraDescarteCustom>) {
    setLocal((prev) => ({
      ...prev,
      descartesExtras: (prev.descartesExtras ?? []).map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }

  function removeDescarteExtra(id: string) {
    setLocal((prev) => ({
      ...prev,
      descartesExtras: (prev.descartesExtras ?? []).filter((r) => r.id !== id),
    }));
    setIsDirty(true);
    setSalvoOk(false);
  }


  async function handleSalvar() {
    if (!pesoValido) return;
    if (!chavesValidas) {
      toast({
        title: "Chaves de pilar inválidas",
        description: "Corrija as chaves conflitantes antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    await saveParametros(local);
    setIsDirty(false);
    setSalvoOk(true);
    setTimeout(() => setSalvoOk(false), 3000);
  }

  async function handleRecalcular() {
    try {
      const n = await recalcularTodos();
      toast({
        title: "Produtos recalculados",
        description: `${n} produto(s) tiveram score atualizado.`,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao recalcular",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  function handleResetar() {
    setLocal(DEFAULT_PARAMETROS);
    setIsDirty(true);
    setSalvoOk(false);
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  const maxThreshold = Math.max(local.decisaoThresholds.excelente, 50);

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Parâmetros do Radar</h2>
          <p className="text-sm text-muted-foreground">
            Configure como o score dos produtos é calculado
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalcular}
            disabled={isRecalculando}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRecalculando && "animate-spin")} />
            {isRecalculando ? "Recalculando..." : "Recalcular produtos"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetar}>
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Restaurar padrões
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={!pesoValido || !chavesValidas || !isDirty || isSaving}
          >
            {isSaving ? (
              "Salvando..."
            ) : salvoOk ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                Salvo
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>

      {isDirty && !salvoOk && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Alterações não salvas. Clique em "Salvar" para aplicar.
          </AlertDescription>
        </Alert>
      )}

      <Accordion
        type="multiple"
        defaultValue={["pesos", "limiares", "descartes"]}
        className="w-full"
      >
        {/* ── PESOS DOS PILARES ── */}
        <AccordionItem value="pesos">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span>Pesos dos Pilares</span>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums px-2 py-0.5 rounded-full border",
                  pesoValido
                    ? "border-emerald-500/40 text-emerald-600"
                    : "border-red-500/40 text-red-600",
                )}
              >
                {somaWeights.toFixed(0)}%
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-5 pt-2">
            {!pesoValido && (
              <div className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                A soma deve ser exatamente 100%. Ajuste os valores abaixo.
              </div>
            )}

            {(Object.keys(PILAR_LABELS) as Array<keyof RadarWeights>).map(
              (key) => {
                const visivel = local.pilaresVisibilidade?.[key] !== false;
                return (
                  <div key={key} className={cn("flex flex-col gap-2", !visivel && "opacity-50")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePilarVisivel(key)}
                          className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
                          title={visivel ? "Ocultar pilar" : "Ativar pilar"}
                        >
                          {visivel ? (
                            <Eye className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                        <Label className="text-sm">{PILAR_LABELS[key]}</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={local.weights[key]}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) setWeight(key, v);
                          }}
                          className="w-16 h-7 text-xs text-center tabular-nums"
                          disabled={!visivel}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Slider
                      value={[local.weights[key]]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={!visivel}
                      onValueChange={([v]) => setWeight(key, v)}
                    />
                  </div>
                );
              },
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span
                className={cn(
                  "text-sm font-mono tabular-nums",
                  pesoValido ? "text-emerald-600" : "text-red-600",
                )}
              >
                {somaWeights.toFixed(0)}%
              </span>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── LIMIARES DE DECISÃO ── */}
        <AccordionItem value="limiares">
          <AccordionTrigger>Limiares de Decisão</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Define a partir de qual score cada classificação é atribuída.
            </p>

            {DECISION_ROWS.map(({ key, label, cor }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex flex-col">
                  <span className={cn("text-sm font-medium", cor)}>
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Score mínimo para {label.split(" ")[1]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Score ≥</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={local.decisaoThresholds[key]}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setThreshold(key, v);
                    }}
                    className="w-20 h-7 text-xs text-center tabular-nums"
                  />
                </div>
              </div>
            ))}

            {/* Preview visual */}
            <div className="flex flex-col gap-1.5 pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Preview das faixas
              </p>
              <div className="flex h-6 rounded-md overflow-hidden border">
                <div
                  className="bg-red-500/70 flex items-center justify-center text-xs"
                  style={{
                    flexBasis: `${(local.decisaoThresholds.cautela / maxThreshold) * 100}%`,
                  }}
                >
                  ❌
                </div>
                <div
                  className="bg-amber-500/70 flex items-center justify-center text-xs"
                  style={{
                    flexBasis: `${((local.decisaoThresholds.viavel - local.decisaoThresholds.cautela) / maxThreshold) * 100}%`,
                  }}
                >
                  ⚠️
                </div>
                <div
                  className="bg-emerald-500/70 flex items-center justify-center text-xs"
                  style={{
                    flexBasis: `${((local.decisaoThresholds.excelente - local.decisaoThresholds.viavel) / maxThreshold) * 100}%`,
                  }}
                >
                  ✅
                </div>
                <div
                  className="bg-violet-500/70 flex-1 flex items-center justify-center text-xs"
                >
                  🚀
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono tabular-nums">
                <span>0</span>
                <span>{local.decisaoThresholds.cautela}</span>
                <span>{local.decisaoThresholds.viavel}</span>
                <span>{local.decisaoThresholds.excelente}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── DESCARTES AUTOMÁTICOS ── */}
        <AccordionItem value="descartes">
          <AccordionTrigger>Descartes Automáticos</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-5 pt-2">
            <p className="text-xs text-muted-foreground">
              Produtos abaixo desses valores são descartados automaticamente,
              independente do score.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Ticket mínimo (preço de venda)</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={local.autoDescarte.ticketMinimo}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setAutoDescarte("ticketMinimo", v);
                  }}
                  className="w-28 h-7 text-xs tabular-nums"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Produtos com preço abaixo de R$ {local.autoDescarte.ticketMinimo}{" "}
                são descartados automaticamente.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Faturamento mínimo estimado</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={local.autoDescarte.faturamentoMinimo}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setAutoDescarte("faturamentoMinimo", v);
                  }}
                  className="w-28 h-7 text-xs tabular-nums"
                />
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Exceto lançamentos. Produtos com faturamento abaixo de R${" "}
                {local.autoDescarte.faturamentoMinimo}/mês são descartados.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── FAIXAS DE PONTUAÇÃO POR PILAR ── */}
        <AccordionItem value="faixas">
          <AccordionTrigger>Faixas de Pontuação por Pilar</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Edite as faixas que definem quantos pontos cada pilar recebe. Marque
              "Escala aberta" na faixa máxima para usar a fórmula{" "}
              <code className="text-[10px]">pontos × (valor / limite)</code>.
            </p>
            <Accordion type="multiple" className="w-full">
              {(Object.keys(PILAR_FAIXA_LABELS) as Array<keyof RadarFaixas>).map(
                (pilar) => {
                  const faixas =
                    local.faixas?.[pilar] ?? DEFAULT_FAIXAS[pilar];
                  const unit = PILAR_UNIT[pilar];
                  const usaMin = unit.direcao === "min";
                  return (
                    <AccordionItem key={pilar} value={pilar}>
                      <AccordionTrigger className="text-sm">
                        {PILAR_FAIXA_LABELS[pilar]}
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {usaMin
                              ? "Maior é melhor — limite mínimo de cada faixa"
                              : "Menor é melhor — limite máximo de cada faixa"}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => addFaixa(pilar)}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Adicionar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => resetFaixaPilar(pilar)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Padrão
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="grid grid-cols-[1fr_90px_70px_auto] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <span>{usaMin ? "Limite mínimo (≥)" : "Limite máximo (≤)"}</span>
                            <span className="text-center">Pontos</span>
                            <span className="text-center">Flags</span>
                            <span />
                          </div>
                          {faixas.map((faixa, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_90px_70px_auto] gap-2 items-center"
                            >
                              <div className="flex items-center gap-1.5">
                                {unit.prefix && (
                                  <span className="text-xs text-muted-foreground">
                                    {unit.prefix}
                                  </span>
                                )}
                                <Input
                                  type="number"
                                  step="any"
                                  value={
                                    usaMin
                                      ? (faixa.limiteMin ?? 0)
                                      : (faixa.limiteMax ?? 0)
                                  }
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v))
                                      setFaixaCampo(
                                        pilar,
                                        i,
                                        usaMin ? "limiteMin" : "limiteMax",
                                        v,
                                      );
                                  }}
                                  className="h-7 text-xs tabular-nums"
                                />
                                {unit.suffix && (
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {unit.suffix}
                                  </span>
                                )}
                              </div>
                              <Input
                                type="number"
                                step="any"
                                value={faixa.pontos}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v)) setFaixaCampo(pilar, i, "pontos", v);
                                }}
                                className="h-7 text-xs text-center tabular-nums"
                              />
                              <div className="flex items-center justify-center gap-1">
                                {usaMin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleFaixaFlag(pilar, i, "escalaAberta")
                                    }
                                    className={cn(
                                      "h-6 px-1.5 rounded border text-[10px] font-medium",
                                      faixa.escalaAberta
                                        ? "bg-violet-500/15 border-violet-500/40 text-violet-600"
                                        : "border-border text-muted-foreground hover:bg-muted",
                                    )}
                                    title="Escala aberta (faixa máxima)"
                                  >
                                    ∞
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleFaixaFlag(pilar, i, "descarte")
                                  }
                                  className={cn(
                                    "h-6 px-1.5 rounded border text-[10px] font-medium",
                                    faixa.descarte
                                      ? "bg-red-500/15 border-red-500/40 text-red-600"
                                      : "border-border text-muted-foreground hover:bg-muted",
                                  )}
                                  title="Descarte automático"
                                >
                                  ✕
                                </button>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => removeFaixa(pilar, i)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                },
              )}
            </Accordion>
          </AccordionContent>
        </AccordionItem>


        {/* ── PILARES PERSONALIZADOS ── */}
        <AccordionItem value="pilares-extras">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span>Pilares Personalizados</span>
              <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                {(local.pilaresExtras ?? []).length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Adicione seus próprios pilares (ex: reviews, ROI, sazonalidade). Cada pilar
              soma pontos diretos ao score total (peso 20 = 1x).
            </p>
            <Button variant="outline" size="sm" className="self-start h-8" onClick={addPilarExtra}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar pilar
            </Button>

            {(local.pilaresExtras ?? []).map((pilar) => (
              <div key={pilar.id} className="rounded-lg border border-border p-3 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Switch
                    checked={pilar.ativo}
                    onCheckedChange={(v) => updatePilarExtra(pilar.id, { ativo: v })}
                  />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px] text-muted-foreground">Nome</Label>
                      <Input
                        value={pilar.label}
                        onChange={(e) => updatePilarExtra(pilar.id, { label: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px] text-muted-foreground">Chave (var)</Label>
                      <Input
                        value={pilar.key}
                        onChange={(e) =>
                          updatePilarExtra(pilar.id, {
                            key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"),
                          })
                        }
                        aria-invalid={!!pilarKeyErrors[pilar.id]}
                        className={cn(
                          "h-8 text-sm font-mono",
                          pilarKeyErrors[pilar.id] && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {pilarKeyErrors[pilar.id] && (
                        <p className="text-[11px] text-destructive">
                          {pilarKeyErrors[pilar.id]} Reservadas: {RESERVED_VAR_KEYS.join(", ")}.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removePilarExtra(pilar.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Direção</Label>
                    <Select
                      value={pilar.direcao}
                      onValueChange={(v: "min" | "max") =>
                        updatePilarExtra(pilar.id, { direcao: v })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="max">Maior é melhor</SelectItem>
                        <SelectItem value="min">Menor é melhor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Peso (mult.)</Label>
                    <Input
                      type="number"
                      value={pilar.peso}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) updatePilarExtra(pilar.id, { peso: v });
                      }}
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">Sufixo (ex: %)</Label>
                    <Input
                      value={pilar.unidade?.suffix ?? ""}
                      onChange={(e) =>
                        updatePilarExtra(pilar.id, {
                          unidade: { ...(pilar.unidade ?? {}), suffix: e.target.value },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground">
                      Faixas ({pilar.direcao === "max" ? "limite mínimo ≥" : "limite máximo ≤"})
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => addFaixaExtra(pilar.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Faixa
                    </Button>
                  </div>
                  {pilar.faixas.map((f, i) => {
                    const usaMin = pilar.direcao === "max";
                    return (
                      <div key={i} className="grid grid-cols-[1fr_80px_60px_auto] gap-2 items-center">
                        <Input
                          type="number"
                          step="any"
                          value={usaMin ? (f.limiteMin ?? 0) : (f.limiteMax ?? 0)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v))
                              setFaixaExtra(pilar.id, i, usaMin ? { limiteMin: v } : { limiteMax: v });
                          }}
                          className="h-7 text-xs tabular-nums"
                        />
                        <Input
                          type="number"
                          step="any"
                          value={f.pontos}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v)) setFaixaExtra(pilar.id, i, { pontos: v });
                          }}
                          className="h-7 text-xs text-center tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFaixaExtra(pilar.id, i, { escalaAberta: !f.escalaAberta })
                          }
                          className={cn(
                            "h-7 rounded border text-[10px] font-medium",
                            f.escalaAberta
                              ? "bg-violet-500/15 border-violet-500/40 text-violet-600"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                          title="Escala aberta"
                        >
                          ∞
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeFaixaExtra(pilar.id, i)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground cursor-pointer flex items-center gap-2">
                    <Switch
                      checked={!!pilar.exibirEmAprovados}
                      onCheckedChange={(v) =>
                        updatePilarExtra(pilar.id, { exibirEmAprovados: v })
                      }
                    />
                    Exibir na tabela de aprovados
                  </Label>
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* ── DESCARTES PERSONALIZADOS ── */}
        <AccordionItem value="descartes-extras">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span>Regras de Descarte Personalizadas</span>
              <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                {(local.descartesExtras ?? []).length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Descarta automaticamente qualquer produto que atenda à condição. Campos
              válidos: <code className="text-[10px]">precoVenda</code>,{" "}
              <code className="text-[10px]">custo</code>,{" "}
              <code className="text-[10px]">margem</code>,{" "}
              <code className="text-[10px]">visitasMes</code>,{" "}
              <code className="text-[10px]">vendasMes</code>,{" "}
              <code className="text-[10px]">concorrentesFull</code>,{" "}
              <code className="text-[10px]">faturamento</code> ou a chave de um pilar
              personalizado.
            </p>
            <Button variant="outline" size="sm" className="self-start h-8" onClick={addDescarteExtra}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra
            </Button>
            {(local.descartesExtras ?? []).map((regra) => (
              <div
                key={regra.id}
                className="grid grid-cols-[auto_1fr_80px_1fr_2fr_auto] gap-2 items-center rounded-lg border border-border p-2"
              >
                <Switch
                  checked={regra.ativo !== false}
                  onCheckedChange={(v) => updateDescarteExtra(regra.id, { ativo: v })}
                />
                <Input
                  value={regra.campo}
                  onChange={(e) => updateDescarteExtra(regra.id, { campo: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="campo"
                />
                <Select
                  value={regra.operador}
                  onValueChange={(v: OperadorDescarte) =>
                    updateDescarteExtra(regra.id, { operador: v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["<", "<=", ">", ">=", "=="] as OperadorDescarte[]).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  value={regra.valor}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) updateDescarteExtra(regra.id, { valor: v });
                  }}
                  className="h-8 text-xs tabular-nums"
                />
                <Input
                  value={regra.motivo ?? ""}
                  onChange={(e) => updateDescarteExtra(regra.id, { motivo: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="Motivo (opcional)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeDescarteExtra(regra.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
