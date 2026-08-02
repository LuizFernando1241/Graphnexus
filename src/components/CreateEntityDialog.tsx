import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CreateEntityValues {
  title: string;
  emoji: string;
  color: string;
  tags: string[];
  parentId: string | null;
}

export interface ParentOption {
  id: string;
  title: string;
  emoji?: string | null;
}

interface CreateEntityDialogProps {
  /** Título do diálogo, ex. "Nova Nota" */
  title: string;
  /** Texto do botão que abre o diálogo */
  triggerLabel: string;
  /** Texto do botão de submit */
  submitLabel: string;
  colors: string[];
  defaultColor?: string;
  showTags?: boolean;
  parentOptions?: ParentOption[];
  parentLabel?: string;
  parentPlaceholder?: string;
  titlePlaceholder?: string;
  isPending?: boolean;
  /** Deve resolver para fechar e limpar o formulário */
  onSubmit: (values: CreateEntityValues) => void | Promise<unknown>;
}

export function CreateEntityDialog({
  title,
  triggerLabel,
  submitLabel,
  colors,
  defaultColor,
  showTags = false,
  parentOptions,
  parentLabel = "Item pai (opcional)",
  parentPlaceholder = "Nenhum",
  titlePlaceholder = "Título",
  isPending = false,
  onSubmit,
}: CreateEntityDialogProps) {
  const initialColor = defaultColor ?? colors[0];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(initialColor);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmoji("");
    setColor(initialColor);
    setTags([]);
    setTagInput("");
    setParentId(null);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  async function handleSubmit() {
    await onSubmit({ title: name, emoji, color, tags, parentId });
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex gap-3">
            <Input
              placeholder="Emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-20 text-center text-lg"
              maxLength={2}
            />
            <Input
              placeholder={titlePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
            />
          </div>

          {parentOptions && (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">{parentLabel}</Label>
              <Select
                value={parentId ?? "none"}
                onValueChange={(v) => setParentId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={parentPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{parentPlaceholder}</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.emoji ? `${p.emoji} ` : ""}
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {showTags && (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  className="flex-1"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addTag}>
                  +
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                    >
                      {t} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Criando..." : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
