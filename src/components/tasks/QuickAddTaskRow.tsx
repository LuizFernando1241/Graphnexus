import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/lib/api/tasks";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { cn } from "@/lib/utils";

export interface QuickAddTaskRowHandle {
  focus: () => void;
}

interface Props {
  defaultStatus?: string;
  defaultDueDate?: string | null;
  placeholder?: string;
}

export const QuickAddTaskRow = forwardRef<QuickAddTaskRowHandle, Props>(function QuickAddTaskRow(
  { defaultStatus, defaultDueDate, placeholder = "Adicionar tarefa..." },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const queryClient = useQueryClient();

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setText("");
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const parsed = parseTaskInput(t);
    mutation.mutate({
      title: parsed.title || t,
      status: defaultStatus || parsed.status,
      priority: parsed.priority,
      due_date: parsed.due_date ?? defaultDueDate ?? null,
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 transition-colors",
        focused ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
      )}
    >
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setText("");
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-0 outline-none py-2.5 text-sm placeholder:text-muted-foreground"
      />
      {focused && (
        <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          ex: "amanhã 14h !p1"
        </span>
      )}
    </div>
  );
});
