import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Plus, ArrowRight, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getStageLabel } from "@/lib/radar/radarScore";
import { useRadarHistorico } from "@/hooks/radar/useRadarHistorico";
import type { RadarProduto, RadarHistorico, PipelineStage } from "@/types/radar";

interface HistoricoModalProps {
  produto: RadarProduto;
  open: boolean;
  onClose: () => void;
}

function getEventConfig(entry: RadarHistorico) {
  if (entry.event === "Produto criado") {
    return {
      icon: <Plus className="h-3.5 w-3.5" />,
      colorClass: "text-emerald-500 bg-emerald-500/10",
    };
  }
  if (entry.field === "stage") {
    return {
      icon: <ArrowRight className="h-3.5 w-3.5" />,
      colorClass: "text-blue-500 bg-blue-500/10",
    };
  }
  return {
    icon: <Pencil className="h-3.5 w-3.5" />,
    colorClass: "text-muted-foreground bg-muted",
  };
}

function formatDescricao(entry: RadarHistorico): string {
  if (entry.event === "Produto criado") return "Produto adicionado ao Radar";
  if (entry.field === "stage")
    return `Movido para ${getStageLabel(entry.newValue as PipelineStage)}`;
  if (entry.field && entry.oldValue !== undefined && entry.newValue !== undefined) {
    return `${entry.field}: "${entry.oldValue || "—"}" → "${entry.newValue || "—"}"`;
  }
  return entry.event;
}

export function HistoricoModal({ produto, open, onClose }: HistoricoModalProps) {
  const { data: historico, isLoading } = useRadarHistorico(open ? produto.id : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico — {produto.nome}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !historico || historico.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-40" />
              <p className="text-sm">Nenhum histórico registrado</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {historico.map((entry) => {
                const config = getEventConfig(entry);
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div
                      className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${config.colorClass}`}
                    >
                      {config.icon}
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <p className="text-sm">{formatDescricao(entry)}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {format(new Date(entry.timestamp), "d MMM yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        {entry.stage && (
                          <span>· {getStageLabel(entry.stage)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
