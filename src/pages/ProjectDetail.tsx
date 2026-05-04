import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Archive, ArchiveRestore, FileOutput, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useProjectDetail } from "@/hooks/useProjectDetail";
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
import type { ProjectStatus } from "@/types/entities";

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

  const {
    project,
    isLoading,
    title,
    emoji,
    description,
    status,
    coverColor,
    startDate,
    targetDate,
    hasUnsavedChanges,
    setTitle,
    setEmoji,
    setDescription,
    setStatus,
    setCoverColor,
    setStartDate,
    setTargetDate,
    handleSave,
    handleDelete,
    handleArchive,
    handleExtract,
    blocker,
    saveMutation,
    deleteMutation,
    archiveMutation,
    extractMutation,
  } = useProjectDetail(id);

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

  if (isLoading || !project) return <DetailPageSkeleton />;

  return (
    <>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <Link to="/projects" className="hover:text-foreground transition-colors">
          Projetos
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate max-w-[200px]">
          {emoji && `${emoji} `}{title || "Sem título"}
        </span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 max-w-5xl">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {/* Color header bar */}
          <div className="h-3 rounded-full" style={{ backgroundColor: coverColor }} />

          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="min-h-[44px]">
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
              <Button variant="ghost" size="icon" onClick={handleArchive} disabled={archiveMutation.isPending} aria-label={project.archived ? "Desarquivar projeto" : "Arquivar projeto"}>
                {project.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Excluir projeto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title + Emoji */}
          <div className="flex items-center gap-3">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🎯"
              className="w-14 text-center text-2xl bg-transparent border-border"
              maxLength={2}
              aria-label="Emoji do projeto"
            />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0"
              placeholder="Nome do projeto"
              aria-label="Nome do projeto"
            />
          </div>

          {/* Status + Color */}
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
                    key={c}
                    type="button"
                    onClick={() => setCoverColor(c)}
                    aria-label={`Cor ${c}`}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      coverColor === c ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Button variant="ghost" onClick={() => blocker.reset?.()}>Voltar</Button>
            <Button variant="secondary" onClick={proceedWithBlocker}>Descartar</Button>
            <Button onClick={async () => { await saveMutation.mutateAsync(); blocker.proceed?.(); }} disabled={saveMutation.isPending}>
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
