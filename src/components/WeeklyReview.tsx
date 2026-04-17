import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays as dfAddDays } from "date-fns";
import { Check, CalendarPlus, SkipForward, Archive, Plus, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { createTask, updateTask } from "@/lib/api/tasks";
import { updateNote } from "@/lib/api/notes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface WeeklyReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEP_TITLES = [
  "Descarregar a mente",
  "Tarefas atrasadas",
  "Notas soltas",
  "Mente limpa ✨",
];

export function WeeklyReview({ open, onOpenChange }: WeeklyReviewProps) {
  const [step, setStep] = useState(0);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const queryClient = useQueryClient();

  const handleClose = () => {
    setStep(0);
    setNewTaskTitle("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "w-full h-full max-w-full max-h-full rounded-none m-0",
          "sm:max-w-2xl sm:max-h-[85vh] sm:rounded-xl sm:m-auto"
        )}
      >
        <DialogHeader className="p-4 md:p-6 pb-2 md:pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              {STEP_TITLES[step]}
            </DialogTitle>
            <span className="text-xs text-muted-foreground">
              {step + 1} / {STEP_TITLES.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1 mt-2">
            {STEP_TITLES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-2 md:pt-3">
          {step === 0 && (
            <StepDump
              value={newTaskTitle}
              onChange={setNewTaskTitle}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && <StepOverdue onNext={() => setStep(2)} />}
          {step === 2 && <StepOrphanNotes onNext={() => setStep(3)} />}
          {step === 3 && <StepDone onClose={handleClose} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───── Step 1: Descarregar ───── */
function StepDump({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const queryClient = useQueryClient();
  const [added, setAdded] = useState<string[]>([]);

  const createMut = useMutation({
    mutationFn: (rawTitle: string) => {
      const parsed = parseTaskInput(rawTitle);
      return createTask({
        title: parsed.title,
        due_date: parsed.due_date,
        status: parsed.status,
        priority: parsed.priority,
      });
    },
    onSuccess: (_, title) => {
      setAdded((prev) => [...prev, title]);
      onChange("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleAdd = () => {
    const t = value.trim();
    if (!t) return;
    createMut.mutate(t);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <p className="text-sm text-muted-foreground">
        Anote tudo que está na sua cabeça. Cada item vira uma tarefa rápida.
      </p>

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="O que está na sua mente?"
          className="flex-1 min-h-[44px]"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          onClick={handleAdd}
          disabled={!value.trim() || createMut.isPending}
          className="min-h-[44px] min-w-[44px]"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {added.length > 0 && (
        <div className="flex flex-col gap-1">
          {added.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{t}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Button onClick={onNext} className="w-full sm:w-auto min-h-[48px] text-base">
          Avançar →
        </Button>
      </div>
    </div>
  );
}

/* ───── Step 2: Atrasadas ───── */
function StepOverdue({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["review-overdue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority")
        .eq("archived", false)
        .neq("status", "done")
        .neq("status", "cancelled")
        .lt("due_date", today)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [dismissed, setDismissed] = useState<string[]>([]);

  const actionMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "done" | "1day" | "1week" }) => {
      if (action === "done") {
        await updateTask(id, { status: "done", completed_at: new Date().toISOString() });
      } else {
        const days = action === "1day" ? 1 : 7;
        const newDate = format(dfAddDays(new Date(), days), "yyyy-MM-dd");
        await updateTask(id, { due_date: newDate });
      }
    },
    onSuccess: (_, { id }) => {
      setDismissed((prev) => [...prev, id]);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const visible = tasks.filter((t) => !dismissed.includes(t.id));

  return (
    <div className="flex flex-col gap-4 h-full">
      <p className="text-sm text-muted-foreground">
        {visible.length === 0
          ? "Nenhuma tarefa atrasada! 🎉"
          : `Você tem ${visible.length} tarefa(s) atrasada(s). Decida o que fazer com cada uma.`}
      </p>

      <div className="flex flex-col gap-2">
        {visible.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 rounded-lg border border-border p-3"
          >
            <span className="flex-1 text-sm truncate">{task.title}</span>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                title="Concluir"
                onClick={() => actionMut.mutate({ id: task.id, action: "done" })}
              >
                <Check className="h-5 w-5 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                title="Adiar 1 dia"
                onClick={() => actionMut.mutate({ id: task.id, action: "1day" })}
              >
                <CalendarPlus className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                title="Adiar 1 semana"
                onClick={() => actionMut.mutate({ id: task.id, action: "1week" })}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <Button onClick={onNext} className="w-full sm:w-auto min-h-[48px] text-base">
          Avançar →
        </Button>
      </div>
    </div>
  );
}

/* ───── Step 3: Notas órfãs ───── */
function StepOrphanNotes({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["review-orphan-notes"],
    queryFn: async () => {
      // Get all linked note IDs
      const { data: links } = await supabase
        .from("entity_links")
        .select("source_id, target_id, source_type, target_type");

      const linkedIds = new Set<string>();
      (links || []).forEach((l) => {
        if (l.source_type === "note") linkedIds.add(l.source_id);
        if (l.target_type === "note") linkedIds.add(l.target_id);
      });

      const { data: allNotes, error } = await supabase
        .from("notes")
        .select("id, title, emoji, color")
        .eq("archived", false)
        .order("updated_at", { ascending: true });
      if (error) throw error;

      return (allNotes || []).filter((n) => !linkedIds.has(n.id));
    },
  });

  const [dismissed, setDismissed] = useState<string[]>([]);

  const archiveMut = useMutation({
    mutationFn: (id: string) => updateNote(id, { archived: true }),
    onSuccess: (_, id) => {
      setDismissed((prev) => [...prev, id]);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const visible = notes.filter((n) => !dismissed.includes(n.id));

  return (
    <div className="flex flex-col gap-4 h-full">
      <p className="text-sm text-muted-foreground">
        {visible.length === 0
          ? "Todas as notas estão conectadas! 🎉"
          : `${visible.length} nota(s) sem vínculo. Arquive as que não precisa mais.`}
      </p>

      <div className="flex flex-col gap-2">
        {visible.slice(0, 10).map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-2 rounded-lg border border-border p-3"
          >
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: note.color || "#7C3AED" }}
            />
            <span className="flex-1 text-sm truncate">
              {note.emoji && `${note.emoji} `}{note.title}
            </span>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                title="Arquivar"
                onClick={() => archiveMut.mutate(note.id)}
              >
                <Archive className="h-5 w-5 text-warning" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                title="Ignorar"
                onClick={() => setDismissed((prev) => [...prev, note.id])}
              >
                <SkipForward className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <Button onClick={onNext} className="w-full sm:w-auto min-h-[48px] text-base">
          Avançar →
        </Button>
      </div>
    </div>
  );
}

/* ───── Step 4: Concluído ───── */
function StepDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full text-center py-8">
      <PartyPopper className="h-16 w-16 text-primary" />
      <div>
        <h2 className="text-xl font-bold mb-2">Parabéns!</h2>
        <p className="text-muted-foreground">
          Sua mente está mais leve. Tarefas organizadas, notas revisadas. Aproveite a semana!
        </p>
      </div>
      <Button onClick={onClose} className="min-h-[48px] w-full sm:w-auto text-base px-8">
        Finalizar
      </Button>
    </div>
  );
}
