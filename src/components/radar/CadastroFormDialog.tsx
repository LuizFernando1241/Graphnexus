import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useEmpresasSolicitantes,
  useFornecedoresCadastro,
  type EmpresaSolicitante,
  type FornecedorCadastro,
} from "@/hooks/radar/useRadarCadastros";

type Modo = "empresa" | "fornecedor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modo: Modo;
  /** Registro em edição; ausente = criar novo */
  empresa?: EmpresaSolicitante | null;
  fornecedor?: FornecedorCadastro | null;
  /** Nome pré-preenchido ao criar */
  nomeInicial?: string;
  onSaved?: (id: string) => void;
  onDeleted?: () => void;
}

interface FormState {
  nome: string;
  cnpj: string;
  responsavel: string;
  empresaNome: string;
  email: string;
  telefone: string;
  endereco: string;
  observacoes: string;
  isDefault: boolean;
}

const VAZIO: FormState = {
  nome: "",
  cnpj: "",
  responsavel: "",
  empresaNome: "",
  email: "",
  telefone: "",
  endereco: "",
  observacoes: "",
  isDefault: false,
};

export function CadastroFormDialog({
  open,
  onOpenChange,
  modo,
  empresa,
  fornecedor,
  nomeInicial,
  onSaved,
  onDeleted,
}: Props) {
  const { criarEmpresa, atualizarEmpresa, removerEmpresa, isSalvando: salvandoEmpresa } =
    useEmpresasSolicitantes();
  const { criarFornecedor, atualizarFornecedor, removerFornecedor, isSalvando: salvandoForn } =
    useFornecedoresCadastro();

  const [form, setForm] = useState<FormState>(VAZIO);
  const [removendo, setRemovendo] = useState(false);

  const editando = modo === "empresa" ? !!empresa : !!fornecedor;
  const salvando = modo === "empresa" ? salvandoEmpresa : salvandoForn;

  useEffect(() => {
    if (!open) return;
    if (modo === "empresa") {
      setForm({
        ...VAZIO,
        nome: empresa?.nome ?? nomeInicial ?? "",
        cnpj: empresa?.cnpj ?? "",
        responsavel: empresa?.responsavel ?? "",
        email: empresa?.email ?? "",
        telefone: empresa?.telefone ?? "",
        endereco: empresa?.endereco ?? "",
        isDefault: empresa?.isDefault ?? false,
      });
    } else {
      setForm({
        ...VAZIO,
        nome: fornecedor?.nome ?? nomeInicial ?? "",
        empresaNome: fornecedor?.empresa ?? "",
        cnpj: fornecedor?.cnpj ?? "",
        responsavel: fornecedor?.contato ?? "",
        email: fornecedor?.email ?? "",
        telefone: fornecedor?.telefone ?? "",
        endereco: fornecedor?.endereco ?? "",
        observacoes: fornecedor?.observacoes ?? "",
      });
    }
  }, [open, modo, empresa, fornecedor, nomeInicial]);

  const set = (campo: keyof FormState, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    try {
      if (modo === "empresa") {
        const input = {
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim(),
          responsavel: form.responsavel.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          endereco: form.endereco.trim(),
          isDefault: form.isDefault,
        };
        const salvo = empresa
          ? await atualizarEmpresa({ id: empresa.id, input })
          : await criarEmpresa(input);
        onSaved?.(salvo.id);
      } else {
        const input = {
          nome: form.nome.trim(),
          empresa: form.empresaNome.trim(),
          cnpj: form.cnpj.trim(),
          contato: form.responsavel.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          endereco: form.endereco.trim(),
          observacoes: form.observacoes.trim(),
        };
        const salvo = fornecedor
          ? await atualizarFornecedor({ id: fornecedor.id, input })
          : await criarFornecedor(input);
        onSaved?.(salvo.id);
      }
      toast.success("Dados salvos.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar.");
    }
  }

  async function remover() {
    try {
      setRemovendo(true);
      if (modo === "empresa" && empresa) await removerEmpresa(empresa.id);
      if (modo === "fornecedor" && fornecedor) await removerFornecedor(fornecedor.id);
      toast.success("Cadastro removido.");
      onDeleted?.();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível remover.");
    } finally {
      setRemovendo(false);
    }
  }

  const titulo =
    modo === "empresa"
      ? editando
        ? "Editar minha empresa"
        : "Nova empresa (minha)"
      : editando
        ? "Editar fornecedor"
        : "Novo fornecedor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {modo === "empresa"
              ? "Dados de quem solicita o orçamento — aparecem como remetente no PDF."
              : "Dados de quem vai receber a solicitação de orçamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cad-nome">
              {modo === "empresa" ? "Nome da empresa *" : "Marca / Fornecedor *"}
            </Label>
            <Input id="cad-nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} />
          </div>

          {modo === "fornecedor" && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cad-empresa">Razão social / Empresa</Label>
              <Input
                id="cad-empresa"
                value={form.empresaNome}
                onChange={(e) => set("empresaNome", e.target.value)}
                maxLength={120}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cad-cnpj">CNPJ</Label>
            <Input
              id="cad-cnpj"
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              placeholder="00.000.000/0001-00"
              maxLength={20}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cad-resp">{modo === "empresa" ? "Responsável" : "Pessoa de contato"}</Label>
            <Input
              id="cad-resp"
              value={form.responsavel}
              onChange={(e) => set("responsavel", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cad-email">E-mail</Label>
            <Input
              id="cad-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              maxLength={160}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cad-tel">Telefone</Label>
            <Input id="cad-tel" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} maxLength={30} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cad-end">Endereço</Label>
            <Input
              id="cad-end"
              value={form.endereco}
              onChange={(e) => set("endereco", e.target.value)}
              maxLength={200}
            />
          </div>

          {modo === "fornecedor" && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cad-obs">Observações</Label>
              <Textarea
                id="cad-obs"
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
          )}

          {modo === "empresa" && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="cad-default"
                checked={form.isDefault}
                onCheckedChange={(v) => set("isDefault", !!v)}
              />
              <Label htmlFor="cad-default" className="font-normal cursor-pointer">
                Usar como empresa padrão
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editando ? (
            <Button variant="ghost" onClick={remover} disabled={removendo} className="text-destructive">
              {removendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
