import { useState, useEffect } from "react";
import { Save, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRadarParametros } from "@/hooks/radar/useRadarParametros";
import { DEFAULT_PARAMETROS } from "@/lib/radar/radarScore";
import { cn } from "@/lib/utils";
import type { RadarParametros, RadarWeights } from "@/types/radar";

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

  async function handleSalvar() {
    if (!pesoValido) return;
    await saveParametros(local);
    setIsDirty(false);
    setSalvoOk(true);
    setTimeout(() => setSalvoOk(false), 3000);
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetar}>
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Restaurar padrões
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={!pesoValido || !isDirty || isSaving}
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
              (key) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">{PILAR_LABELS[key]}</Label>
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
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[local.weights[key]]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => setWeight(key, v)}
                  />
                </div>
              ),
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
      </Accordion>
    </div>
  );
}
