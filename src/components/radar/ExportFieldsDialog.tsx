import { useState, useEffect } from "react";
import { FloatingWindow } from "@/components/ui/floating-window";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ExportField, ExportFieldCategory } from "@/lib/radar/radarExportFields";
import { EXPORT_CATEGORIES } from "@/lib/radar/radarExportFields";

interface ExportFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: ExportField[];
  onExport: (selectedFieldIds: string[]) => void;
}

const LOCAL_STORAGE_KEY = "radar-export-fields";

export function ExportFieldsDialog({
  open,
  onOpenChange,
  fields,
  onExport,
}: ExportFieldsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFirstTime, setIsFirstTime] = useState(true);

  // Carregar seleção salva do localStorage
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setSelectedIds(new Set(parsed));
            setIsFirstTime(false);
            return;
          }
        } catch (e) {
          console.error("Erro ao carregar seleção de campos:", e);
        }
      }
      // Primeira vez: marcar todos
      setSelectedIds(new Set(fields.map((f) => f.id)));
      setIsFirstTime(true);
    }
  }, [open, fields]);

  // Salvar seleção no localStorage ao exportar
  function handleExport() {
    const idsArray = Array.from(selectedIds);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(idsArray));
    onExport(idsArray);
    onOpenChange(false);
  }

  function toggleAll() {
    if (selectedIds.size === fields.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(fields.map((f) => f.id)));
    }
  }

  function toggleField(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(category: ExportFieldCategory) {
    const categoryFields = fields.filter((f) => f.category === category);
    const allSelected = categoryFields.every((f) => selectedIds.has(f.id));
    
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        categoryFields.forEach((f) => next.delete(f.id));
      } else {
        categoryFields.forEach((f) => next.add(f.id));
      }
      return next;
    });
  }

  // Agrupar campos por categoria
  const fieldsByCategory = fields.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<ExportFieldCategory, ExportField[]>);

  const categories = Object.keys(EXPORT_CATEGORIES) as ExportFieldCategory[];
  const sortedCategories = categories.sort(
    (a, b) => EXPORT_CATEGORIES[a].order - EXPORT_CATEGORIES[b].order
  );

  return (
    <FloatingWindow
        storageKey="radar-export"
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={700}
      defaultHeight={620}
      title="Selecionar campos para exportação"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={selectedIds.size === 0}>
            Exportar ({selectedIds.size} campo{selectedIds.size !== 1 ? "s" : ""})
          </Button>
        </>
      }
    >
        <div>
          <div className="space-y-4">
            {/* Botão marcar/desmarcar todos */}
            <div className="flex items-center gap-2 pb-3 border-b">
              <Checkbox
                id="toggle-all"
                checked={selectedIds.size === fields.length && fields.length > 0}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="toggle-all" className="cursor-pointer font-medium">
                {selectedIds.size === fields.length && fields.length > 0
                  ? "Desmarcar todos"
                  : "Marcar todos"}
              </Label>
              <span className="text-sm text-muted-foreground ml-auto">
                {selectedIds.size} de {fields.length} selecionados
              </span>
            </div>

            {/* Campos por categoria */}
            {sortedCategories.map((category) => {
              const categoryFields = fieldsByCategory[category] || [];
              if (categoryFields.length === 0) return null;

              const allSelected = categoryFields.every((f) => selectedIds.has(f.id));
              const someSelected = categoryFields.some((f) => selectedIds.has(f.id));

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${category}`}
                      checked={allSelected}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                    <Label
                      htmlFor={`cat-${category}`}
                      className="cursor-pointer font-semibold text-sm"
                    >
                      {EXPORT_CATEGORIES[category].label}
                    </Label>
                  </div>
                  <div className="pl-6 grid grid-cols-2 gap-2">
                    {categoryFields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <Checkbox
                          id={field.id}
                          checked={selectedIds.has(field.id)}
                          onCheckedChange={() => toggleField(field.id)}
                        />
                        <Label
                          htmlFor={field.id}
                          className="cursor-pointer text-xs truncate"
                          title={field.label}
                        >
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </FloatingWindow>
  );
}
