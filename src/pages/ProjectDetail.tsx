import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Archive, ArchiveRestore, FileOutput, ChevronRight, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { exportProject } from "@/lib/markdown/export";
import { format } from "date-fns";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import { useProjects } from "@/hooks/useProjects";
import { createProject } from "@/lib/api/projects";
import { fetchLinkedTasksForProject, fetchLinkedNotesForProject } from "@/lib/api/projectStats";
import { LinkPanelDock } from "@/components/LinkPanelDock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProjectHero } from "@/components/projects/ProjectHero";
import { ProjectNarrative } from "@/components/projects/ProjectNarrative";
import { ProjectAIPanel } from "@/components/projects/ProjectAIPanel";
import { ProjectTasksTab } from "@/components/projects/ProjectTasksTab";
import { ProjectNotesTab } from "@/components/projects/ProjectNotesTab";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/entities";
import { wouldCreateCycle } from "@/lib/projectProgress";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Completo" },
  { value: "archived", label: "Arquivado" },
];

const PROJECT_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#0EA5E9"];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    project, isLoading,
    title, emoji, description, status, coverColor, startDate, targetDate, parentId,
    hasUnsavedChanges,
    setTitle, setEmoji, setDescription, setStatus, setCoverColor, setStartDate, setTargetDate, setParentId,
    handleSave, handleDelete, handleArchive, handleExtract,
    blocker, saveMutation, deleteMutation, archiveMutation, extractMutation,
  } = useProjectDetail(id);

  const { projects: allProjects, getBreadcrumb } = useProjects({ showArchived: true });
  const breadcrumb = id ? getBreadcrumb(id) : [];
  const parentCandidates = allProjects.filter(
    (p) => p.id !== id && !wouldCreateCycle(id ?? "", p.id, allProjects),
  );


  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [subprojectOpen, setSubprojectOpen] = useState(false);
  const [subprojectTitle, setSubprojectTitle] = useState("");

  const createSubproject = useMutation({
    mutationFn: async (titleArg: string) => {
      if (!id) throw new Error("No project ID");
      return createProject({
        title: titleArg.trim() || "Novo subprojeto",
        parent_id: id,
        cover_color: coverColor,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Subprojeto criado!");
      setSubprojectOpen(false);
      setSubprojectTitle("");
      if (created?.id) navigate(`/projects/${created.id}`);
    },
    onError: () => toast.error("Erro ao criar subprojeto"),
  });


  const { data: linkedTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["project-linked-tasks", id],
    queryFn: () => fetchLinkedTasksForProject(id!),
    enabled: !!id,
  });

  const { data: linkedNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["project-linked-notes", id],
    queryFn: () => fetchLinkedNotesForProject(id!),
    enabled: !!id,
  });

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

  if (isLoading || !project) return <DetailPageSkeleton />;

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
        <Link to="/projects" className="hover:text-foreground transition-colors">Projetos</Link>
        {breadcrumb.slice(0, -1).map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to={`/projects/${c.id}`} className="hover:text-foreground transition-colors truncate max-w-[160px]">
              {c.emoji ? `${c.emoji} ` : ""}{c.title}
            </Link>
          </span>
        ))}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate max-w-[200px]">
          {emoji && `${emoji} `}{title || "Sem título"}
        </span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 flex flex-col gap-5 min-w-0 w-full">
          {/* Top actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="min-h-[44px]">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnsavedChanges && <span className="text-xs text-primary animate-pulse">Alterações não salvas</span>}
              <Button onClick={handleSave} disabled={!hasUnsavedChanges || saveMutation.isPending} size="sm">
                <Save className="mr-1 h-4 w-4" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSubprojectOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Subprojeto
              </Button>
              <Button
                variant="ghost" size="icon" title="Exportar como Markdown"
                aria-label="Exportar projeto como Markdown"
                onClick={async () => {
                  try { await exportProject(project); toast.success("Exportado!"); }
                  catch { toast.error("Falha ao exportar"); }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleArchive} disabled={archiveMutation.isPending}
                aria-label={project.archived ? "Desarquivar" : "Arquivar"}>
                {project.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)} aria-label="Excluir projeto">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Hero */}
          <ProjectHero
            project={project}
            title={title}
            emoji={emoji}
            status={status}
            coverColor={coverColor}
            startDate={startDate}
            targetDate={targetDate}
            linkedTasksCount={linkedTasks.length}
            onTitleChange={setTitle}
            onEmojiChange={setEmoji}
          />

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Visão geral</TabsTrigger>
              <TabsTrigger value="tasks">Tarefas {linkedTasks.length > 0 && `(${linkedTasks.length})`}</TabsTrigger>
              <TabsTrigger value="notes">Notas {linkedNotes.length > 0 && `(${linkedNotes.length})`}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5 mt-4">
              <ProjectMetrics tasks={linkedTasks} startDate={project.start_date} targetDate={project.target_date} />

              <ProjectAIPanel project={project} tasks={linkedTasks} notes={linkedNotes} />

              {/* Status + Color + Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Cor</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c} type="button" onClick={() => setCoverColor(c)}
                        aria-label={`Cor ${c}`}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${coverColor === c ? "scale-110 border-foreground" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data de início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data alvo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !targetDate && "text-muted-foreground")}>
                        {targetDate ? format(targetDate, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={targetDate} onSelect={setTargetDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  {description && (
                    <Button variant="ghost" size="sm" onClick={() => setExtractOpen(true)}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                      <FileOutput className="mr-1 h-3.5 w-3.5" />
                      Transformar em Nota
                    </Button>
                  )}
                </div>
                <RichTextEditor content={description} onChange={setDescription} />
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <ProjectTasksTab projectId={id!} tasks={linkedTasks} isLoading={tasksLoading} />
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <ProjectNotesTab notes={linkedNotes} isLoading={notesLoading} />
            </TabsContent>
          </Tabs>
        </div>

        <LinkPanelDock entityId={id!} entityType="project" />
      </div>

      {/* Extract Dialog */}
      <AlertDialog open={extractOpen} onOpenChange={setExtractOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformar Descrição em Nota?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual será removido desta descrição e movido para uma nova Nota independente. Ela será automaticamente vinculada a este item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setExtractOpen(false)}>Cancelar</Button>
            <Button onClick={() => { handleExtract(); setExtractOpen(false); }} disabled={extractMutation.isPending}>
              {extractMutation.isPending ? "Transformando..." : "Transformar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Blocker */}
      <AlertDialog open={blocker.state === "blocked"} onOpenChange={() => blocker.reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>Você tem alterações que ainda não foram salvas. O que deseja fazer?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => blocker.reset?.()}>Voltar</Button>
            <Button variant="secondary" onClick={() => blocker.proceed?.()}>Descartar</Button>
            <Button onClick={async () => { await saveMutation.mutateAsync(); blocker.proceed?.(); }} disabled={saveMutation.isPending}>
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
