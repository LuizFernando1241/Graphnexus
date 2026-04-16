import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, addMonths, isAfter, startOfDay, format } from "date-fns";
import { toast } from "sonner";
import { updateTask, createTask } from "@/lib/api/tasks";
import { fetchEntityLinks, createEntityLink } from "@/lib/api/links";
import { invalidateAllEntities } from "@/lib/cache";
import type { Task } from "@/types/entities";

function parseRecurrenceRule(rule: string): { unit: "day" | "week" | "month" | "custom_days"; interval: number } | null {
  const parts = rule.split(":");
  if (parts.length !== 3 || parts[0] !== "every") return null;
  const interval = parseInt(parts[1], 10);
  const unit = parts[2] as "day" | "week" | "month" | "custom_days";
  if (isNaN(interval) || !["day", "week", "month", "custom_days"].includes(unit)) return null;
  return { unit, interval };
}

function computeNextDate(baseDate: string | null, rule: string, recurrenceDays?: number[] | null): string | null {
  const parsed = parseRecurrenceRule(rule);
  if (!parsed) return null;

  const today = startOfDay(new Date());
  const base = baseDate ? startOfDay(new Date(baseDate)) : today;
  const effectiveBase = isAfter(today, base) ? today : base;

  if (parsed.unit === "custom_days" && recurrenceDays && recurrenceDays.length > 0) {
    let candidate = addDays(effectiveBase, 1);
    for (let i = 0; i < 7; i++) {
      if (recurrenceDays.includes(candidate.getDay())) {
        return format(candidate, "yyyy-MM-dd");
      }
      candidate = addDays(candidate, 1);
    }
    return null;
  }

  let next: Date;
  switch (parsed.unit) {
    case "day":
      next = addDays(effectiveBase, parsed.interval);
      break;
    case "week":
      next = addWeeks(effectiveBase, parsed.interval);
      break;
    case "month":
      next = addMonths(effectiveBase, parsed.interval);
      break;
    default:
      return null;
  }

  return format(next, "yyyy-MM-dd");
}

export function useCompleteRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      await updateTask(task.id, {
        status: "done",
        completed_at: new Date().toISOString(),
      });

      if (task.recurrence_rule) {
        const nextDue = computeNextDate(task.due_date, task.recurrence_rule, task.recurrence_days);

        if (task.recurrence_end_date && nextDue) {
          const end = new Date(task.recurrence_end_date);
          const next = new Date(nextDue);
          if (isAfter(next, end)) {
            toast.info("Recorrência encerrada");
            return;
          }
        }

        const todayStr = format(new Date(), "yyyy-MM-dd");
        const isTodayOrPast = nextDue ? nextDue <= todayStr : false;

        const newTask = await createTask({
          title: task.title,
          description: task.description || undefined,
          status: isTodayOrPast ? "todo" : "backlog",
          priority: task.priority,
          due_date: nextDue,
          estimated_minutes: task.estimated_minutes,
          subtasks: task.subtasks?.map((st: any) => ({ ...st, completed: false })) || [],
          recurrence_rule: task.recurrence_rule,
          recurrence_end_date: task.recurrence_end_date,
          recurrence_parent_id: task.recurrence_parent_id || task.id,
          recurrence_days: task.recurrence_days,
        });

        const links = await fetchEntityLinks(task.id, "task");
        for (const link of links) {
          await createEntityLink({
            source_type: link.source_id === task.id ? "task" : link.source_type,
            source_id: link.source_id === task.id ? newTask.id : link.source_id,
            target_type: link.target_id === task.id ? "task" : link.target_type,
            target_id: link.target_id === task.id ? newTask.id : link.target_id,
            label: link.label || undefined,
          });
        }

        toast.success("Tarefa concluída — próxima ocorrência criada");
      } else {
        toast.success("Tarefa concluída");
      }
    },
    onSuccess: () => {
      invalidateAllEntities(queryClient);
    },
    onError: () => {
      toast.error("Erro ao completar tarefa");
    },
  });
}

export function useSkipRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      if (!task.recurrence_rule) throw new Error("Tarefa não é recorrente");

      const nextDue = computeNextDate(task.due_date, task.recurrence_rule, task.recurrence_days);
      if (!nextDue) throw new Error("Não foi possível calcular a próxima data");

      if (task.recurrence_end_date) {
        const end = new Date(task.recurrence_end_date);
        const next = new Date(nextDue);
        if (isAfter(next, end)) {
          toast.info("Recorrência encerrada — não há mais datas");
          return;
        }
      }

      const todayStr = format(new Date(), "yyyy-MM-dd");
      const isTodayOrPast = nextDue ? nextDue <= todayStr : false;
      
      await updateTask(task.id, { 
        due_date: nextDue, 
        status: isTodayOrPast ? "todo" : "backlog" 
      });
    },
    onSuccess: () => {
      invalidateAllEntities(queryClient);
      toast.success("Ocorrência pulada para a próxima data");
    },
    onError: () => {
      toast.error("Erro ao pular ocorrência");
    },
  });
}

export { parseRecurrenceRule };
