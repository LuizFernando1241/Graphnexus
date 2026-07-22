import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SortField, SortDirection, ColumnSortConfig } from "@/types/radar";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "scoreTotal", label: "Pontuação/Score" },
  { field: "margem", label: "Margem" },
  { field: "precoVenda", label: "Ticket / Preço" },
  { field: "vendasMes", label: "Vendas/mês" },
  { field: "visitasMes", label: "Visitas/mês" },
  { field: "stageEnteredAt", label: "Tempo na etapa" },
];

interface ColumnSortControlProps {
  sortConfig: ColumnSortConfig | null;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onClear: () => void;
}

export function ColumnSortControl({
  sortConfig,
  onSortChange,
  onClear,
}: ColumnSortControlProps) {
  const [open, setOpen] = useState(false);

  const currentOption = SORT_OPTIONS.find((opt) => opt.field === sortConfig?.field);

  function handleSort(field: SortField) {
    if (sortConfig?.field === field) {
      // Toggle direction if same field
      const newDirection: SortDirection = sortConfig.direction === "asc" ? "desc" : "asc";
      onSortChange(field, newDirection);
    } else {
      // New field, default to desc (highest first)
      onSortChange(field, "desc");
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 text-xs",
            sortConfig ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {sortConfig ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 mr-1" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 mr-1" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
          )}
          {currentOption?.label || "Ordenar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((option) => {
            const isActive = sortConfig?.field === option.field;
            const direction = isActive ? sortConfig.direction : null;

            return (
              <button
                key={option.field}
                type="button"
                onClick={() => handleSort(option.field)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground",
                )}
              >
                <span>{option.label}</span>
                {direction === "asc" && <ArrowUp className="h-3 w-3" />}
                {direction === "desc" && <ArrowDown className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
        {sortConfig && (
          <>
            <div className="border-t border-border my-1" />
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
              Limpar ordenação
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
