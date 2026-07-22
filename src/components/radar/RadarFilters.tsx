import { X, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RadarProduto, DecisionBadge, PipelineStage } from "@/types/radar";

export interface RadarFiltersState {
  fornecedor: string;
  decision: DecisionBadge | "all";
  stage: PipelineStage | "all";
  busca: string;
}

interface RadarFiltersProps {
  produtos: RadarProduto[];
  filters: RadarFiltersState;
  onChange: (filters: RadarFiltersState) => void;
}

export function RadarFilters({ produtos, filters, onChange }: RadarFiltersProps) {
  const fornecedores = Array.from(new Set(produtos.map((p) => p.fornecedor))).sort();
  const hasActive =
    filters.fornecedor !== "all" ||
    filters.decision !== "all" ||
    filters.stage !== "all" ||
    filters.busca.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou fornecedor"
          value={filters.busca}
          onChange={(e) => onChange({ ...filters, busca: e.target.value })}
          className="pl-8 h-9 w-64"
        />
      </div>


      <Select
        value={filters.fornecedor}
        onValueChange={(v) => onChange({ ...filters, fornecedor: v })}
      >
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder="Fornecedor" />
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

      <Select
        value={filters.decision}
        onValueChange={(v) => onChange({ ...filters, decision: v as RadarFiltersState["decision"] })}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Decisão" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as decisões</SelectItem>
          <SelectItem value="excelente">🚀 Excelente</SelectItem>
          <SelectItem value="viavel">✅ Viável</SelectItem>
          <SelectItem value="cautela">⚠️ Cautela</SelectItem>
          <SelectItem value="descarte">❌ Descarte</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.stage}
        onValueChange={(v) => onChange({ ...filters, stage: v as RadarFiltersState["stage"] })}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Etapa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as etapas</SelectItem>
          <SelectItem value="prospeccao">Prospecção</SelectItem>
          <SelectItem value="aguardando_custo">Aguardando Custo</SelectItem>
          <SelectItem value="aguardando_decisao">Aguardando Decisão</SelectItem>
          <SelectItem value="decisao">Decisão</SelectItem>
        </SelectContent>
      </Select>

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ fornecedor: "all", decision: "all", stage: "all", busca: "" })}
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
