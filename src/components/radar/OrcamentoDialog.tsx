import { useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import type { RadarProduto } from "@/types/radar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produtos: RadarProduto[];
}

interface DadosSolicitante {
  empresa: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
}

const DADOS_INICIAIS: DadosSolicitante = {
  empresa: "",
  cnpj: "",
  responsavel: "",
  email: "",
  telefone: "",
};

export function OrcamentoDialog({ open, onOpenChange, produtos }: Props) {
  const [fornecedor, setFornecedor] = useState<string>("");
  const [selecionados, setSelecionados] = useState<Record<string, number>>({});
  const [dados, setDados] = useLocalStorage<DadosSolicitante>("radar-orcamento-solicitante", DADOS_INICIAIS);
  const { empresa, cnpj, responsavel, email, telefone } = dados;
  const setCampo = (campo: keyof DadosSolicitante, valor: string) => setDados({ ...dados, [campo]: valor });
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);


  const fornecedores = useMemo(
    () => Array.from(new Set(produtos.map((p) => p.fornecedor).filter(Boolean))).sort(),
    [produtos],
  );

  const produtosDoFornecedor = useMemo(
    () => produtos.filter((p) => p.fornecedor === fornecedor),
    [produtos, fornecedor],
  );

  function toggleProduto(p: RadarProduto) {
    setSelecionados((prev) => {
      const next = { ...prev };
      if (next[p.id] !== undefined) delete next[p.id];
      else next[p.id] = p.quantidadePedir && p.quantidadePedir > 0 ? p.quantidadePedir : 1;
      return next;
    });
  }

  function reset() {
    setFornecedor("");
    setSelecionados({});
    setObservacoes("");
    setPrazo("");
  }

  const itens = produtosDoFornecedor.filter((p) => selecionados[p.id] !== undefined);

  function gerarPDF() {
    if (!empresa.trim() || !cnpj.trim()) {
      toast.error("Informe o nome da empresa e o CNPJ.");
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
      doc.text("Dados do solicitante", margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
        body: [
          ["Empresa", empresa],
          ["CNPJ", cnpj],
          ["Responsável", responsavel || "—"],
          ["E-mail", email || "—"],
          ["Telefone", telefone || "—"],
        ],
        margin: { left: margin, right: margin },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 24;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Fornecedor / Marca: ${fornecedor}`, margin, y);
      y += 16;

      autoTable(doc, {
        startY: y,
        head: [["#", "Produto", "Qtd. solicitada", "Referência"]],
        body: itens.map((p, i) => [
          String(i + 1),
          p.nome,
          String(selecionados[p.id] ?? 1),
          p.linkML ? p.linkML : "—",
        ]),
        styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 26 }, 2: { cellWidth: 90, halign: "center" }, 3: { cellWidth: 170 } },
        margin: { left: margin, right: margin },
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
        `orcamento-${(fornecedor || "fornecedor").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Solicitar orçamento
          </DialogTitle>
          <DialogDescription>
            Selecione a marca e os produtos, informe seus dados e gere um PDF formal de pedido de orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Marca / Fornecedor</Label>
            <Select
              value={fornecedor}
              onValueChange={(v) => {
                setFornecedor(v);
                setSelecionados({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fornecedor && (
            <div className="flex flex-col gap-2">
              <Label>
                Produtos ({itens.length} selecionado{itens.length === 1 ? "" : "s"})
              </Label>
              <ScrollArea className="max-h-56 rounded-md border border-border">
                <div className="divide-y divide-border">
                  {produtosDoFornecedor.length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">Nenhum produto para esta marca.</p>
                  )}
                  {produtosDoFornecedor.map((p) => {
                    const checked = selecionados[p.id] !== undefined;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2.5">
                        <Checkbox checked={checked} onCheckedChange={() => toggleProduto(p)} id={`orc-${p.id}`} />
                        <label htmlFor={`orc-${p.id}`} className="flex-1 truncate text-sm cursor-pointer">
                          {p.nome}
                        </label>
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
                          className="h-8 w-20 text-center"
                          aria-label={`Quantidade de ${p.nome}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orc-empresa">Nome da empresa *</Label>
              <Input id="orc-empresa" value={empresa} onChange={(e) => setCampo("empresa", e.target.value)} maxLength={120} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orc-cnpj">CNPJ *</Label>
              <Input
                id="orc-cnpj"
                value={cnpj}
                onChange={(e) => setCampo("cnpj", e.target.value)}
                placeholder="00.000.000/0001-00"
                maxLength={20}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orc-resp">Responsável</Label>
              <Input id="orc-resp" value={responsavel} onChange={(e) => setCampo("responsavel", e.target.value)} maxLength={120} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orc-email">E-mail</Label>
              <Input id="orc-email" type="email" value={email} onChange={(e) => setCampo("email", e.target.value)} maxLength={160} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orc-tel">Telefone</Label>
              <Input id="orc-tel" value={telefone} onChange={(e) => setCampo("telefone", e.target.value)} maxLength={30} />

            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orc-prazo">Prazo desejado para resposta</Label>
              <Input id="orc-prazo" value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Ex.: 5 dias úteis" maxLength={60} />
            </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={gerarPDF} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
