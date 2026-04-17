import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { StickyNote, CheckSquare, FolderKanban, AlertTriangle, Clock as ClockIcon, Activity, Settings, Sparkles, Check } from "lucide-react";
import { format, isToday, isBefore, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateTask } from "@/lib/api/tasks";
import { useCompleteRecurringTask } from "@/hooks/useRecurrence";
import type { Task } from "@/types/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SwipeableItem } from "@/components/ui/SwipeableItem";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { WeeklyReview } from "@/components/WeeklyReview";
import { PageTransition } from "@/components/PageTransition";
import { DashboardSkeleton } from "@/components/ui/page-skeleton";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

async function fetchDashboardData() {
  const today = format(new Date(), "yyyy-MM-dd");
  const threeDaysFromNow = format(addDays(new Date(), 3), "yyyy-MM-dd");

  const [
    notesCount,
    tasksCount,
    projectsCount,
    recentNotes,
    overdueTasks,
    upcomingTasks,
    activityFeed,
  ] = await Promise.all([
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("archived", false).neq("status", "cancelled"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("notes").select("id, title, emoji, color, updated_at").eq("archived", false).order("updated_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("*").eq("archived", false).neq("status", "done").neq("status", "cancelled").lt("due_date", today).not("due_date", "is", null),
    supabase.from("tasks").select("*").eq("archived", false).neq("status", "done").neq("status", "cancelled").gte("due_date", today).lte("due_date", threeDaysFromNow).not("due_date", "is", null).order("due_date", { ascending: true }),
    supabase.from("tasks").select("id, title, status, updated_at").eq("archived", false).order("updated_at", { ascending: false }).limit(8),
  ]);

  return {
    counts: {
      notes: notesCount.count || 0,
      tasks: tasksCount.count || 0,
      projects: projectsCount.count || 0,
    },
    recentNotes: recentNotes.data || [],
    overdueTasks: (overdueTasks.data || []) as unknown as Task[],
    upcomingTasks: (upcomingTasks.data || []) as unknown as Task[],
    activityFeed: activityFeed.data || [],
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#3B82F6",
  none: "#6B7280",
};
const DEFAULT_PRIORITY_COLOR = "#6B7280";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewDay, setReviewDay] = useLocalStorage("nexus_review_day", 5);
  const [reviewOpen, setReviewOpen] = useState(false);
  const completeRecurring = useCompleteRecurringTask();

  const isReviewDay = new Date().getDay() === reviewDay;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardData,
  });

  const postponeMutation = useMutation({
    mutationFn: async ({ id, dueDate }: { id: string; dueDate: string }) => {
      const newDate = format(addDays(new Date(dueDate + "T00:00:00"), 1), "yyyy-MM-dd");
      return updateTask(id, { due_date: newDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa adiada para amanhã");
    },
  });

  const allDueTasks = useMemo(
    () => (data ? [...data.overdueTasks, ...data.upcomingTasks] : []),
    [data]
  );

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  return (
    <PageTransition>
    <div className="flex flex-col gap-6">
      {/* Review Banner */}
      {isReviewDay && (
        <div className="relative rounded-xl p-4 md:p-6 bg-gradient-to-r from-[hsl(var(--card))] to-[hsl(var(--background))] border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Revisão Semanal</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {getGreeting()}! Hoje é o dia da sua Revisão Semanal. Que tal tirar 5 minutos para limpar a mente?
              </p>
            </div>
            <Button
              onClick={() => setReviewOpen(true)}
              className="min-h-[48px] w-full sm:w-auto text-base"
            >
              Iniciar Revisão
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <Label className="text-xs text-muted-foreground mb-2 block">Dia da revisão</Label>
              <Select
                value={String(reviewDay)}
                onValueChange={(v) => setReviewDay(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">{getGreeting()} 👋</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/notes")}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <StickyNote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.counts.notes}</p>
              <p className="text-xs text-muted-foreground">Notas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/tasks")}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <CheckSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.counts.tasks}</p>
              <p className="text-xs text-muted-foreground">Tarefas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/projects")}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.counts.projects}</p>
              <p className="text-xs text-muted-foreground">Projetos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue + Upcoming Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Tarefas urgentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allDueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa urgente 🎉</p>
            ) : (
              <div className="flex flex-col gap-2">
                {allDueTasks.map((task) => {
                  const due = new Date(task.due_date! + "T00:00:00");
                  const overdue = isBefore(due, startOfDay(new Date()));
                  return (
                    <SwipeableItem
                      key={task.id}
                      onSwipeRight={() =>
                        completeRecurring.mutate(task)
                      }
                      onSwipeLeft={() =>
                        postponeMutation.mutate({
                          id: task.id,
                          dueDate: task.due_date!,
                        })
                      }
                      rightIcon={Check}
                      leftIcon={ClockIcon}
                      rightBgColor="bg-success"
                      leftBgColor="bg-warning"
                    >
                      <button
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors w-full min-h-[44px]"
                      >
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? DEFAULT_PRIORITY_COLOR }}
                        />
                        <span className="flex-1 truncate text-foreground">{task.title}</span>
                        <Badge variant={overdue ? "destructive" : "secondary"} className="text-xs">
                          {overdue ? "Atrasada" : isToday(due) ? "Hoje" : format(due, "dd/MM")}
                        </Badge>
                      </button>
                    </SwipeableItem>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
              Notas recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma nota ainda</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.recentNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => navigate(`/notes/${note.id}`)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors min-h-[44px]"
                  >
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: note.color || "#7C3AED" }} />
                    <span className="flex-1 truncate text-foreground">
                      {note.emoji && `${note.emoji} `}{note.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.updated_at), "dd/MM")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Atividade recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {data.activityFeed.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/tasks/${item.id}`)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors min-h-[44px]"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-foreground">{item.title}</span>
                  <Badge variant="secondary" className="text-xs capitalize">{item.status.replace("_", " ")}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(item.updated_at), "dd/MM HH:mm")}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Review Modal */}
      <WeeklyReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
    </PageTransition>
  );
}
