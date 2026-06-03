import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { parseFiles, importItems } from "@/lib/markdown/import";
import { useQueryClient } from "@tanstack/react-query";
import type { EntityType } from "@/types/entities";

interface Props {
  /** Entity type assumed when the file has no frontmatter. */
  defaultType: EntityType;
  children: React.ReactNode;
  className?: string;
}

export function ImportDropzone({ defaultType, children, className }: Props) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files || []).filter((f) =>
        /\.(md|zip)$/i.test(f.name),
      );
      if (files.length === 0) return;
      setImporting(true);
      const toastId = toast.loading(`Importando ${files.length} arquivo(s)...`);
      try {
        const items = await parseFiles(files, defaultType);
        if (items.length === 0) {
          toast.error("Nenhum arquivo .md encontrado", { id: toastId });
          return;
        }
        const result = await importItems(items);
        queryClient.invalidateQueries({ queryKey: ["notes"] });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        toast.success(
          `${result.created.length} item(ns) importado(s)` +
            (result.skipped.length ? ` · ${result.skipped.length} ignorado(s)` : ""),
          { id: toastId },
        );
      } catch (err) {
        console.error(err);
        toast.error("Falha ao importar arquivos", { id: toastId });
      } finally {
        setImporting(false);
      }
    },
    [defaultType, queryClient],
  );

  return (
    <div
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={handleDrop}
      className={cn("relative", className)}
    >
      {children}
      {(dragging || importing) && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card p-8 shadow-2xl">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-base font-semibold text-foreground">
              {importing ? "Importando..." : "Solte para importar .md ou .zip"}
            </p>
            <p className="text-xs text-muted-foreground">
              {importing ? "Criando entidades" : `Padrão: ${defaultType}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
