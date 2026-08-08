import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloatingWindow } from "@/components/ui/floating-window";
import { parseFiles, importItems, type ParsedItem } from "@/lib/markdown/import";
import type { EntityType } from "@/types/entities";

const TYPE_LABEL: Record<EntityType, string> = {
  note: "Nota",
  task: "Tarefa",
  project: "Projeto",
  product: "Produto",
};

interface Props {
  /** Tipo assumido quando o arquivo não tem frontmatter. */
  defaultType: EntityType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Quando omitido, renderiza o botão padrão "Importar". */
  trigger?: React.ReactNode;
}

export function ImportDialog({ defaultType, open, onOpenChange, trigger }: Props) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [items, setItems] = useState<ParsedItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());

  const handleFiles = async (files: File[]) => {
    const valid = files.filter((f) => /\.(md|zip)$/i.test(f.name));
    if (valid.length === 0) {
      toast.error("Envie arquivos .md ou .zip");
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseFiles(valid, defaultType);
      setItems((prev) => [...prev, ...parsed]);
      toast.success(`${parsed.length} item(ns) prontos para importar`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao ler arquivos");
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files || []));
  };

  const toggleSkip = (key: string) => {
    setSkip((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const changeType = (key: string, newType: EntityType) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, type: newType } : it)));
  };

  const runImport = async () => {
    const toImport = items.filter((i) => !skip.has(i.key));
    if (toImport.length === 0) {
      toast.error("Nada para importar");
      return;
    }
    setImporting(true);
    const toastId = toast.loading(`Importando ${toImport.length} item(ns)...`);
    try {
      const result = await importItems(toImport);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(
        `${result.created.length} criado(s)` +
          (result.skipped.length ? ` · ${result.skipped.length} com erro` : ""),
        { id: toastId },
      );
      setItems([]);
      setSkip(new Set());
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Falha na importação", { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  const counts = items.reduce(
    (acc, it) => {
      if (skip.has(it.key)) return acc;
      acc[it.type] = (acc[it.type] || 0) + 1;
      return acc;
    },
    { note: 0, task: 0, project: 0, product: 0 } as Record<EntityType, number>,
  );

  return (
    <>
      {trigger !== null && (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger ?? (
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
          )}
        </span>
      )}

      <FloatingWindow
        open={isOpen}
        onOpenChange={setOpen}
        defaultWidth={860}
        defaultHeight={680}
        title="Importar Markdown"
        description="Envie arquivos .md ou .zip exportados (próprios ou estilo Obsidian)."
      >

        <label
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragging(false);
          }}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragging ? "border-primary bg-accent/40" : "border-border bg-card hover:bg-accent/20"
          }`}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            Arraste .md ou .zip ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Suporta múltiplos arquivos. Anexos do .zip são re-enviados para a biblioteca.
          </p>
          <input
            type="file"
            accept=".md,.zip"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              handleFiles(files);
              e.target.value = "";
            }}
          />
        </label>

        {parsing && <p className="text-sm text-muted-foreground">Lendo arquivos...</p>}

        {items.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">{items.length - skip.size}</span>
                <span className="text-muted-foreground">de {items.length} serão importados</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {counts.note} nota(s), {counts.task} tarefa(s), {counts.project} projeto(s)
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setItems([]);
                    setSkip(new Set());
                  }}
                >
                  Limpar
                </Button>
                <Button onClick={runImport} disabled={importing} size="sm">
                  {importing ? "Importando..." : `Importar ${items.length - skip.size} item(ns)`}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Arquivo</th>
                    <th className="text-left px-3 py-2 font-medium">Título</th>
                    <th className="text-left px-3 py-2 font-medium">Tipo</th>
                    <th className="text-left px-3 py-2 font-medium">Avisos</th>
                    <th className="text-right px-3 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const isSkipped = skip.has(it.key);
                    return (
                      <tr
                        key={it.key}
                        className={`border-t border-border ${isSkipped ? "opacity-40" : ""}`}
                      >
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" /> {it.source}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">{it.title}</td>
                        <td className="px-3 py-2">
                          <select
                            value={it.type}
                            onChange={(e) => changeType(it.key, e.target.value as EntityType)}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                            aria-label="Tipo do item importado"
                          >
                            <option value="note">{TYPE_LABEL.note}</option>
                            <option value="task">{TYPE_LABEL.task}</option>
                            <option value="project">{TYPE_LABEL.project}</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {it.warnings.length === 0 ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </Badge>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-warning">
                              <AlertTriangle className="h-3 w-3" /> {it.warnings[0]}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => toggleSkip(it.key)}>
                            {isSkipped ? "Incluir" : "Pular"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </FloatingWindow>
    </>
  );
}
