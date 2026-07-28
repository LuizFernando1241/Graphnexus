import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DECISION_SOLID } from "@/lib/radar/decisionColors";
import type { RadarProduto } from "@/types/radar";

interface PilarDotsProps {
  produto: RadarProduto;
}

const PILARES = [
  { key: "margem", label: "Margem de Lucro", check: (p: RadarProduto) => p.margem != null },
  { key: "ticket", label: "Ticket Médio", check: (p: RadarProduto) => p.precoVenda != null },
  { key: "demanda", label: "Demanda / Faturamento", check: (p: RadarProduto) => !p.isLancamento && p.vendasMes != null },
  { key: "visitas", label: "Visitas por Mês", check: (p: RadarProduto) => p.visitasMes != null },
  { key: "concorrentes", label: "Concorrentes no Full", check: (p: RadarProduto) => p.concorrentesFull != null },
];

const DOT_COLOR = DECISION_SOLID;


export function PilarDots({ produto }: PilarDotsProps) {
  return (
    <div className="flex items-center gap-1">
      {PILARES.map(({ key, label, check }) => {
        const preenchido = check(produto);
        const isLancamentoDemanda = key === "demanda" && produto.isLancamento;
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  preenchido ? DOT_COLOR[produto.decision] : "bg-muted-foreground/30",
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isLancamentoDemanda
                ? `${label} (ignorado — lançamento)`
                : preenchido
                ? `${label} ✓`
                : `${label} — não preenchido`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
