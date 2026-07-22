import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AdvancedFilters, DecisionBadge, RadarProduto } from "@/types/radar";

interface AdvancedFiltersProps {
  filters: AdvancedFilters;
  onChange: (filters: Partial<AdvancedFilters>) => void;
  onClear: () => void;
  produtos: RadarProduto[];
  visibleCount: number;
  totalCount: number;
}

const DECISION_OPTIONS: { value: DecisionBadge | "all"; label: string }[] = [
  { value: "all", label: "Todas as classificações" },
  { value: "excelente", label: "🚀 Excelente" },
  { value: "viavel", label: "✅ Viável" },
  { value: "cautela", label: "⚠️ Cautela" },
  { value: "descarte", label: "❌ Descarte" },
];

export function AdvancedFilters({
  filters,
  onChange,
  onClear,
  produtos,
  visibleCount,
  totalCount,
}: AdvancedFiltersProps) {
  const fornecedores = Array.from(new Set(produtos.map((p) => p.fornecedor))).sort();

  const hasActiveFilters =
    filters.scoreMin !== undefined ||
    filters.scoreMax !== undefined ||
    filters.decision !== undefined ||
    filters.fornecedor !== undefined ||
    filters.margemMin !== undefined ||
    filters.margemMax !== undefined ||
    filters.ticketMin !== undefined ||
    filters.ticketMax !== undefined;

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Filtros Avançados</h3>
          <p className="text-xs text-muted-foreground">
            {visibleCount} de {totalCount} produtos visíveis
          </p>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar todos
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Faixa de Score */}
        <div className="space-y-2">
          <Label className="text-xs">Pontuação/Score</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              min={0}
              max={100}
              value={filters.scoreMin ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined;
                onChange({ scoreMin: value });
              }}
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="Max"
              min={0}
              max={100}
              value={filters.scoreMax ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined;
                onChange({ scoreMax: value });
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Classificação */}
        <div className="space-y-2">
          <Label className="text-xs">Classificação</Label>
          <Select
            value={filters.decision ?? "all"}
            onValueChange={(value) =>
              onChange({ decision: value === "all" ? undefined : (value as DecisionBadge) })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DECISION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fornecedor */}
        <div className="space-y-2">
          <Label className="text-xs">Fornecedor</Label>
          <Select
            value={filters.fornecedor ?? "all"}
            onValueChange={(value) =>
              onChange({ fornecedor: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="md:col-span-2 lg:col-span-3" />

        {/* Faixa de Margem */}
        <div className="space-y-2">
          <Label className="text-xs">Margem (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              min={0}
              max={100}
              value={filters.margemMin ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined;
                onChange({ margemMin: value });
              }}
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="Max"
              min={0}
              max={100}
              value={filters.margemMax ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined;
                onChange({ margemMax: value });
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Faixa de Ticket */}
        <div className="space-y-2">
          <Label className="text-xs">Ticket / Preço (R$)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              min={0}
              step={0.01}
              value={filters.ticketMin ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined;
                onChange({ ticketMin: value });
              }}
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="Max"
              min={0}
              step={0.01}
              value={filters.ticketMax ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : undefined;
                onChange({ ticketMax: value });
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
