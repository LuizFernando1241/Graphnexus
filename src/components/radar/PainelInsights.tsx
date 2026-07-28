import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Lightbulb,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRadarSinais } from "@/hooks/radar/useRadarSinais";
import type { SinalTipo } from "@/lib/radar/radarSinais";

const SINAL_CONFIG: Record<
  SinalTipo,
  {
    icon: React.ReactNode;
    className: string;
    badgeClass: string;
    label: string;
  }
> = {
  atencao: {
    icon: <AlertCircle className="h-4 w-4 shrink-0" />,
    className:
      "text-warning bg-warning/10 border-warning/30",
    badgeClass:
      "bg-warning/15 text-warning border-warning/30",
    label: "Atenção",
  },
  oportunidade: {
    icon: <Lightbulb className="h-4 w-4 shrink-0" />,
    className:
      "text-success bg-success/10 border-success/30",
    badgeClass:
      "bg-success/15 text-success border-success/30",
    label: "Oportunidade",
  },
  risco: {
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    className:
      "text-destructive bg-destructive/10 border-destructive/30",
    badgeClass:
      "bg-destructive/15 text-destructive border-destructive/30",
    label: "Risco",
  },
  info: {
    icon: <Info className="h-4 w-4 shrink-0" />,
    className:
      "text-info bg-info/10 border-info/30",
    badgeClass:
      "bg-info/15 text-info border-info/30",
    label: "Info",
  },
};

export function PainelInsights() {
  const navigate = useNavigate();
  const { sinais, urgentes, isLoading } = useRadarSinais();
  const [expandido, setExpandido] = useState(false);

  if (isLoading || sinais.length === 0) return null;

  const visiveis = expandido ? sinais : sinais.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Insights do Radar</h3>
          {urgentes.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {urgentes.length} urgente{urgentes.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {sinais.length} alerta{sinais.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {visiveis.map((sinal) => {
          const config = SINAL_CONFIG[sinal.tipo];
          return (
            <button
              key={sinal.id}
              type="button"
              onClick={() => navigate("/radar")}
              className={cn(
                "rounded-lg border p-3 text-left transition-all hover:shadow-sm hover:-translate-y-px",
                config.className,
              )}
            >
              <div className="flex items-start gap-2.5">
                {config.icon}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium">{sinal.titulo}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", config.badgeClass)}
                    >
                      {config.label}
                    </Badge>
                    {sinal.urgente && (
                      <Badge
                        variant="destructive"
                        className="text-[10px]"
                      >
                        Urgente
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs opacity-90">{sinal.descricao}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {sinais.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center text-xs"
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 mr-1" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Ver mais {sinais.length - 3} alerta
              {sinais.length - 3 !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t">
        <Sparkles className="h-3 w-3" />
        Análise com IA em breve
      </div>
    </div>
  );
}
