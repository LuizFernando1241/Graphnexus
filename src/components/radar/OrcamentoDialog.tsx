import { useEffect, useMemo, useState } from "react";
import { Building2, FileText, Loader2, Pencil, Plus, Truck, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FloatingWindow } from "@/components/ui/floating-window";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CadastroFormDialog } from "./CadastroFormDialog";
import {
  useEmpresasSolicitantes,
  useFornecedoresCadastro,
  type EmpresaSolicitante,
  type FornecedorCadastro,
} from "@/hooks/radar/useRadarCadastros";
import type { RadarProduto } from "@/types/radar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produtos: RadarProduto[];
}

export function OrcamentoDialog({ open, onOpenChange, produtos }: Props) {
  const { empresas } = useEmpresasSolicitantes();
  const { fornecedores: cadastros } = useFornecedoresCadastro();

  const [empresaId, setEmpresaId] = useState<string>("");
  const [marca, setMarca] = useState<string>("");
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [selecionados, setSelecionados] = useState<Record<string, number>>({});
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);

  const [cadastroModo, setCadastroModo] = useState<"empresa" | "fornecedor">("empresa");
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [editandoEmpresa, setEditandoEmpresa] = useState<EmpresaSolicitante | null>(null);
  const [editandoFornecedor, setEditandoFornecedor] = useState<FornecedorCadastro | null>(null);

  const empresa = empresas.find((e) => e.id === empresaId) ?? null;
  const fornecedorCad = cadastros.find((f) => f.id === fornecedorId) ?? null;

  // Seleciona a empresa padrão automaticamente
  useEffect(() => {
    if (!open || empresaId) return;
    const padrao = empresas.find((e) => e.isDefault) ?? empresas[0];
    if (padrao) setEmpresaId(padrao.id);
  }, [open, empresas, empresaId]);

  // Ao escolher a marca, tenta casar com um fornecedor já cadastrado
  useEffect(() => {
    if (!marca) return;
    const match = cadastros.find((f) => f.nome.toLowerCase() === marca.toLowerCase());
    setFornecedorId(match ? match.id : "");
  }, [marca, cadastros]);

  const marcas = useMemo(
    () => Array.from(new Set(produtos.map((p) => p.fornecedor).filter(Boolean))).sort(),
    [produtos],
  );

  const produtosDaMarca = useMemo(() => produtos.filter((p) => p.fornecedor === marca), [produtos, marca]);
  const itens = produtosDaMarca.filter((p) => selecionados[p.id] !== undefined);

  function toggleProduto(p: RadarProduto) {
    setSelecionados((prev) => {
      const next = { ...prev };
      if (next[p.id] !== undefined) delete next[p.id];
      else next[p.id] = p.quantidadePedir && p.quantidadePedir > 0 ? p.quantidadePedir : 1;
      return next;
    });
  }

  function reset() {
    setMarca("");
    setFornecedorId("");
    setSelecionados({});
    setObservacoes("");
    setPrazo("");
  }

  function abrirCadastro(modo: "empresa" | "fornecedor", editar: boolean) {
    setCadastroModo(modo);
    setEditandoEmpresa(modo === "empresa" && editar ? empresa : null);
    setEditandoFornecedor(modo === "fornecedor" && editar ? fornecedorCad : null);
    setCadastroOpen(true);
  }

  function gerarPDF() {
    if (!empresa) {
      toast.error("Selecione (ou cadastre) a sua empresa.");
      return;
    }
    if (itens.length === 0) {
      toast.error("Selecione ao menos um produto.");
      return;
    }
    setGerando(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      let y = margin;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("SOLICITAÇÃO DE ORÇAMENTO", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(
        `Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        margin,
        y,
      );
      y += 20;
      doc.setDrawColor(200);
      doc.line(margin, y, 595 - margin, y);
      y += 24;

      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Solicitante (remetente)", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
        body: [
          ["Empresa", empresa.nome],
          ["CNPJ", empresa.cnpj || "—"],
          ["Responsável", empresa.responsavel || "—"],
          ["E-mail", empresa.email || "—"],
          ["Telefone", empresa.telefone || "—"],
          ...(empresa.endereco ? [["Endereço", empresa.endereco]] : []),
        ],
        margin: { left: margin, right: margin },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Fornecedor (destinatário)", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
        body: [
          ["Marca / Fornecedor", fornecedorCad?.nome || marca],
          ...(fornecedorCad?.empresa ? [["Razão social", fornecedorCad.empresa]] : []),
          ...(fornecedorCad?.cnpj ? [["CNPJ", fornecedorCad.cnpj]] : []),
          ...(fornecedorCad?.contato ? [["Contato", fornecedorCad.contato]] : []),
          ...(fornecedorCad?.email ? [["E-mail", fornecedorCad.email]] : []),
          ...(fornecedorCad?.telefone ? [["Telefone", fornecedorCad.telefone]] : []),
        ],
        margin: { left: margin, right: margin },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 24;

      autoTable(doc, {
        startY: y,
        head: [["#", "Produto", "Qtd. solicitada"]],
        body: itens.map((p, i) => [String(i + 1), p.nome, String(selecionados[p.id] ?? 1)]),
        styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 26 }, 2: { cellWidth: 90, halign: "center" } },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
          if (data.section !== "body" || data.column.index !== 1) return;
          const link = itens[data.row.index]?.linkML;
          if (!link) return;
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: link });
        },
        didParseCell: (data) => {
          if (data.section !== "body" || data.column.index !== 1) return;
          if (!itens[data.row.index]?.linkML) return;
          data.cell.styles.textColor = [29, 78, 216];
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 24;

      if (prazo.trim()) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Prazo desejado para resposta:", margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(prazo, margin + 175, y);
        y += 20;
      }

      if (observacoes.trim()) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Observações", margin, y);
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const linhas = doc.splitTextToSize(observacoes, 595 - margin * 2);
        doc.text(linhas, margin, y);
        y += linhas.length * 13 + 10;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      const texto = doc.splitTextToSize(
        "Solicitamos gentilmente o envio de orçamento para os itens listados acima, contendo preço unitário, prazo de entrega, condições de pagamento e validade da proposta. Ficamos à disposição para quaisquer esclarecimentos.",
        595 - margin * 2,
      );
      doc.text(texto, margin, y);

      doc.save(
        `orcamento-${(marca || "fornecedor").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("PDF de solicitação de orçamento gerado.");
      onOpenChange(false);
      reset();
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <FloatingWindow
        open={open}
        onOpenChange={onOpenChange}
        defaultWidth={760}
        defaultHeight={680}
        title={
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Solicitar orçamento
          </span>
        }
        description="Confirme seus dados, escolha o fornecedor e os produtos para gerar o PDF formal. Arraste o título para mover, use os cantos para redimensionar."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={gerarPDF} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Gerar PDF
            </Button>
          </>
        }
      >
          <div className="min-w-0 flex flex-col gap-5">

            {/* 1 — Meus dados */}
            <section className="rounded-lg border border-border p-3 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-medium">Meus dados (quem solicita)</p>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue placeholder="Selecione a sua empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                        {e.isDefault ? " (padrão)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => abrirCadastro("empresa", true)}
                  disabled={!empresa}
                  aria-label="Editar minha empresa"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => abrirCadastro("empresa", false)} aria-label="Nova empresa">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {empresa
                  ? [empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.responsavel, empresa.email]
                      .filter(Boolean)
                      .join(" · ") || "Sem dados complementares"
                  : "Cadastre a sua empresa uma única vez — os dados ficam salvos."}
              </p>
            </section>

            {/* 2 — Fornecedor */}
            <section className="rounded-lg border border-border p-3 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-medium">Fornecedor (para quem vou enviar)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground">Marca dos produtos</Label>
                  <Select
                    value={marca}
                    onValueChange={(v) => {
                      setMarca(v);
                      setSelecionados({});
                    }}
                  >
                    <SelectTrigger className="min-w-0">
                      <SelectValue placeholder="Selecione a marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {marcas.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <Label className="text-xs text-muted-foreground">Cadastro do fornecedor</Label>
                  <div className="flex items-center gap-2 min-w-0">
                    <Select value={fornecedorId} onValueChange={setFornecedorId}>
                      <SelectTrigger className="min-w-0 flex-1">
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        {cadastros.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => abrirCadastro("fornecedor", true)}
                      disabled={!fornecedorCad}
                      aria-label="Editar fornecedor"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => abrirCadastro("fornecedor", false)}
                      aria-label="Novo fornecedor"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {fornecedorCad && (
                <p className="text-xs text-muted-foreground truncate">
                  {[fornecedorCad.cnpj && `CNPJ ${fornecedorCad.cnpj}`, fornecedorCad.contato, fornecedorCad.email]
                    .filter(Boolean)
                    .join(" · ") || "Sem dados complementares"}
                </p>
              )}
            </section>

            {/* 3 — Produtos */}
            {marca && (
              <div className="flex flex-col gap-2 min-w-0">
                <Label>
                  Produtos ({itens.length} selecionado{itens.length === 1 ? "" : "s"})
                </Label>
                <ScrollArea className="h-56 rounded-md border border-border">
                  <div className="divide-y divide-border">
                    {produtosDaMarca.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum produto para esta marca.</p>
                    )}
                    {produtosDaMarca.map((p) => {
                      const checked = selecionados[p.id] !== undefined;
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-2.5 min-w-0">
                          <Checkbox checked={checked} onCheckedChange={() => toggleProduto(p)} id={`orc-${p.id}`} />
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex-1 min-w-0 truncate text-left text-sm hover:underline"
                                title="Ver título completo"
                              >
                                {p.nome}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="max-w-sm break-words text-sm">
                              <p className="font-medium">{p.nome}</p>
                              {p.linkML && (
                                <a
                                  href={p.linkML}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Abrir anúncio
                                </a>
                              )}
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="number"
                            min={1}
                            disabled={!checked}
                            value={checked ? selecionados[p.id] : ""}
                            onChange={(e) =>
                              setSelecionados((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, Number(e.target.value) || 1),
                              }))
                            }
                            className="h-8 w-16 shrink-0 text-center"
                            aria-label={`Quantidade de ${p.nome}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* 4 — Detalhes */}
            <div className="flex flex-col gap-3 min-w-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orc-prazo">Prazo desejado para resposta</Label>
                <Input
                  id="orc-prazo"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  placeholder="Ex.: 5 dias úteis"
                  maxLength={60}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="orc-obs">Observações</Label>
                <Textarea
                  id="orc-obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Condições de pagamento, frete, prazo de entrega..."
                />
              </div>
            </div>
          </div>
      </FloatingWindow>


      <CadastroFormDialog
        open={cadastroOpen}
        onOpenChange={setCadastroOpen}
        modo={cadastroModo}
        empresa={editandoEmpresa}
        fornecedor={editandoFornecedor}
        nomeInicial={cadastroModo === "fornecedor" && !editandoFornecedor ? marca : undefined}
        onSaved={(id) => (cadastroModo === "empresa" ? setEmpresaId(id) : setFornecedorId(id))}
        onDeleted={() => (cadastroModo === "empresa" ? setEmpresaId("") : setFornecedorId(""))}
      />
    </>
  );
}
