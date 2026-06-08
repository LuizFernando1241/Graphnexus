import { useState } from 'react'
import { Plus, X, FileText, CheckSquare, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { useRadarEntityLinks } from '@/hooks/radar/useRadarEntityLinks'
import {
  useNotas,
  useTarefas,
  useProjetos,
} from '@/hooks/radar/useGraphNexusEntidades'
import { useNavigate } from 'react-router-dom'
import type { RadarProduto, EntityLinkType, RadarEntityLink } from '@/types/radar'

interface PainelConexoesProps {
  produto: RadarProduto
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

interface DisponivelItem {
  id: string
  display: string
  sub?: string
}

interface SecaoProps {
  tipo: EntityLinkType
  label: string
  icon: React.ReactNode
  linkados: RadarEntityLink[]
  disponiveis: DisponivelItem[]
  nomeItem: (id: string) => string
  onNavigate: (id: string) => void
  popoverAberto: EntityLinkType | null
  setPopoverAberto: (t: EntityLinkType | null) => void
  onAdd: (tipo: EntityLinkType, id: string) => void
  onRemove: (linkId: string) => void
}

function Secao({
  tipo,
  label,
  icon,
  linkados,
  disponiveis,
  nomeItem,
  onNavigate,
  popoverAberto,
  setPopoverAberto,
  onAdd,
  onRemove,
}: SecaoProps) {
  const podeAdicionar = tipo !== 'project' || linkados.length === 0
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {icon}
          {label}
        </div>
        {podeAdicionar && (
          <Popover
            open={popoverAberto === tipo}
            onOpenChange={(v) => setPopoverAberto(v ? tipo : null)}
          >
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
                <CommandList>
                  <CommandEmpty>Nenhum(a) encontrado(a).</CommandEmpty>
                  <CommandGroup>
                    {disponiveis.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.display} ${item.sub ?? ''}`}
                        onSelect={() => onAdd(tipo, item.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="truncate">{item.display}</span>
                          {item.sub && (
                            <span className="text-[11px] text-muted-foreground">
                              {item.sub}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {linkados.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhum(a) linkado(a)
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {linkados.map((link) => (
            <div
              key={link.id}
              className="group flex items-center justify-between gap-2 rounded-md border border-border bg-card/40 px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => onNavigate(link.entityId)}
                className="text-sm truncate flex-1 text-left hover:text-primary hover:underline"
              >
                {nomeItem(link.entityId)}
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => onRemove(link.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PainelConexoes({ produto }: PainelConexoesProps) {
  const navigate = useNavigate()
  const { links, isLoading, adicionarLink, removerLink } = useRadarEntityLinks(
    produto.id,
  )
  const { data: notas } = useNotas()
  const { data: tarefas } = useTarefas()
  const { data: projetos } = useProjetos()

  const [popoverAberto, setPopoverAberto] = useState<EntityLinkType | null>(null)

  const notasLinkadas = links.filter((l) => l.entityType === 'note')
  const tarefasLinkadas = links.filter((l) => l.entityType === 'task')
  const projetosLinkados = links.filter((l) => l.entityType === 'project')

  async function handleAdd(entityType: EntityLinkType, entityId: string) {
    await adicionarLink({ entityType, entityId })
    setPopoverAberto(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Secao
        tipo="note"
        label="Notas"
        icon={<FileText className="h-3.5 w-3.5" />}
        linkados={notasLinkadas}
        disponiveis={(notas ?? [])
          .filter((n) => !notasLinkadas.some((l) => l.entityId === n.id))
          .map((n) => ({
            id: n.id,
            display: `${n.emoji ?? '📝'} ${n.titulo}`,
            sub: n.preview || undefined,
          }))}
        nomeItem={(id) => {
          const n = (notas ?? []).find((x) => x.id === id)
          return n ? `${n.emoji ?? '📝'} ${n.titulo}` : id
        }}
        onNavigate={(id) => navigate(`/notes/${id}`)}
        popoverAberto={popoverAberto}
        setPopoverAberto={setPopoverAberto}
        onAdd={handleAdd}
        onRemove={removerLink}
      />

      <Secao
        tipo="task"
        label="Tarefas"
        icon={<CheckSquare className="h-3.5 w-3.5" />}
        linkados={tarefasLinkadas}
        disponiveis={(tarefas ?? [])
          .filter((t) => !tarefasLinkadas.some((l) => l.entityId === t.id))
          .map((t) => ({
            id: t.id,
            display: t.titulo,
            sub: STATUS_LABELS[t.status] ?? t.status,
          }))}
        nomeItem={(id) => {
          const t = (tarefas ?? []).find((x) => x.id === id)
          return t ? t.titulo : id
        }}
        onNavigate={(id) => navigate(`/tasks/${id}`)}
        popoverAberto={popoverAberto}
        setPopoverAberto={setPopoverAberto}
        onAdd={handleAdd}
        onRemove={removerLink}
      />

      <Secao
        tipo="project"
        label="Projeto"
        icon={<FolderOpen className="h-3.5 w-3.5" />}
        linkados={projetosLinkados}
        disponiveis={(projetos ?? [])
          .filter((p) => !projetosLinkados.some((l) => l.entityId === p.id))
          .map((p) => ({
            id: p.id,
            display: `${p.emoji ?? '📁'} ${p.nome}`,
          }))}
        nomeItem={(id) => {
          const p = (projetos ?? []).find((x) => x.id === id)
          return p ? `${p.emoji ?? '📁'} ${p.nome}` : id
        }}
        onNavigate={(id) => navigate(`/projects/${id}`)}
        popoverAberto={popoverAberto}
        setPopoverAberto={setPopoverAberto}
        onAdd={handleAdd}
        onRemove={removerLink}
      />
    </div>
  )
}
