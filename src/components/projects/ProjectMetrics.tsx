import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from "recharts";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/types/entities";
import { buildBurndownSeries, computeProgress } from "@/lib/api/projectStats";

interface Props {
  tasks: Task[];
  startDate?: string | null;
  targetDate?: string | null;
}

export function ProjectMetrics({ tasks, startDate, targetDate }: Props) {
  const stats = computeProgress(tasks);
  const burndown = buildBurndownSeries(tasks, startDate, targetDate);
  const upcoming = tasks
    .filter((t) => t.due_date && t.status !== "done")
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Progresso */}
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">Progresso</div>
        <div className="text-2xl font-heading font-bold mb-2">{stats.percent}%</div>
        <Progress value={stats.percent} className="h-2" />
        <div className="text-xs text-muted-foreground mt-2">{stats.done} de {stats.total} tarefas</div>
      </Card>

      {/* Status */}
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-2">Por status</div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">Backlog {stats.backlog}</Badge>
          <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-300">A fazer {stats.todo}</Badge>
          <Badge variant="secondary" className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300">Andamento {stats.inProgress}</Badge>
          <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Concluídas {stats.done}</Badge>
        </div>
      </Card>

      {/* Próximas */}
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-2">Próximas datas</div>
        {upcoming.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Sem tarefas com data</div>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((t) => (
              <li key={t.id} className="text-xs">
                <Link to={`/tasks/${t.id}`} className="hover:text-primary line-clamp-1 block">
                  {format(parseISO(t.due_date! + "T00:00:00"), "dd/MM")} — {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Burndown */}
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">Burndown</div>
        {burndown.length < 2 ? (
          <div className="text-xs text-muted-foreground italic h-20 flex items-center">
            Defina datas e adicione tarefas
          </div>
        ) : (
          <div className="h-20 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burndown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: "4px 8px", background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="remaining" stroke="hsl(var(--primary))" fill="url(#bd)" strokeWidth={2} />
                <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" dot={false} strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
