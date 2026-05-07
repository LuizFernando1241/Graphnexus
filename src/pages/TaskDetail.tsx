import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Check, Archive, SkipForward, FileOutput, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { useCompleteRecurringTask, useSkipRecurringTask } from "@/hooks/useRecurrence";
import { RecurrenceSelector } from "@/components/RecurrenceSelector";
import { LinkPanelDock } from "@/components/LinkPanelDock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@/types/entities";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "A Fazer" },
  { value: "in_progress", label: "Em Progresso" },
  { value: "done", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const completeRecurring = useCompleteRecurringTask();
  const skipRecurring = useSkipRecurringTask();

  const {
    task,
    isLoading,
    title,
    description,
    status,
    priority,
    dueDate,
    dueTime,
    recurrenceRule,
    recurrenceDays,
    estimatedMinutes,
    hasUnsavedChanges,
    setTitle,
    setDescription,
    setStatus,
    setPriority,
    setDueDate,
    setDueTime,
    setRecurrenceRule,
    setRecurrenceDays,
    setEstimatedMinutes,
    handleSave,
    handleDelete,
    handleArchive,
    handleExtract,
    blocker,
    saveMutation,
    deleteMutation,
    archiveMutation,
    extractMutation,
  } = useTaskDetail(id);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasUnsavedChanges, handleSave]);

  const closeExtractDialog = () => setExtractOpen(false);
  const proceedWithBlocker = () => blocker.proceed?.();

  if (isLoading || !task) return <DetailPageSkeleton />;

  return (
    <>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <Link to="/tasks" className="hover:text-foreground transition-colors">
          Tarefas
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate max-w-[200px]">{title || "Sem título"}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")} className="min-h-[44px]">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnsavedChanges && (
                <span className="text-xs text-primary animate-pulse">Alterações não salvas</span>
              )}
              <Button onClick={handleSave} disabled={!hasUnsavedChanges || saveMutation.isPending} size="sm">
                <Save className="mr-1 h-4 w-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              {task.status !== "done" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => completeRecurring.mutate(task)}
                >
                  <Check className="mr-1 h-4 w-4" /> Concluir
                </Button>
              )}
              {task.recurrence_rule && task.status !== "done" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => skipRecurring.mutate(task)}
                  disabled={skipRecurring.isPending}
                >
                  <SkipForward className="mr-1 h-4 w-4" /> Pular
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                title="Arquivar"
                aria-label="Arquivar tarefa"
                onClick={handleArchive}
                disabled={archiveMutation.isPending}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Excluir tarefa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0"
            placeholder="Título da tarefa"
            aria-label="Título da tarefa"
          />

          {/* Status + Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date + time */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Data de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                  >
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Horário</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full sm:w-32"
                aria-label="Horário de entrega"
              />
            </div>
          </div>

          {/* Estimated minutes */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tempo estimado (min)</Label>
            <Input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="Ex: 30"
              className="w-32"
              aria-label="Tempo estimado em minutos"
            />
          </div>

          {/* Recurrence */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Recorrência</Label>
            <RecurrenceSelector
              value={recurrenceRule}
              onChange={setRecurrenceRule}
              recurrenceDays={recurrenceDays}
              onRecurrenceDaysChange={setRecurrenceDays}
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              {description && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExtractOpen(true)}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <FileOutput className="mr-1 h-3.5 w-3.5" />
                  Transformar em Nota
                </Button>
              )}
            </div>
            <RichTextEditor
              content={description}
              onChange={setDescription}
            />
          </div>
        </div>

        {/* Right sidebar - Links (resizable on desktop) */}
        <LinkPanelDock entityId={id!} entityType="task" />
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extract Dialog */}
      <AlertDialog open={extractOpen} onOpenChange={closeExtractDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformar Descrição em Nota?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual será removido desta descrição e movido para uma nova Nota independente. Ela será automaticamente vinculada a este item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={closeExtractDialog}>Cancelar</Button>
            <Button
              variant="default"
              onClick={() => {
                handleExtract();
                closeExtractDialog();
              }}
              disabled={extractMutation.isPending}
            >
              {extractMutation.isPending ? "Transformando..." : "Transformar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Blocker */}
      <AlertDialog open={blocker.state === "blocked"} onOpenChange={() => blocker.reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações que ainda não foram salvas. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => blocker.reset?.()}>
              Voltar
            </Button>
            <Button
              variant="secondary"
              onClick={proceedWithBlocker}
            >
              Descartar
            </Button>
            <Button
              onClick={async () => { await saveMutation.mutateAsync(); proceedWithBlocker(); }}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
