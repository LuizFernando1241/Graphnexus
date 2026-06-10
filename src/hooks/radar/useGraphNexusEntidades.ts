import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export interface NotaResumida {
  id: string
  titulo: string
  preview: string
  emoji?: string
  criadoEm: string
}

export interface TarefaResumida {
  id: string
  titulo: string
  status: string
  prioridade?: string
  dataVencimento?: string
}

export interface ProjetoResumido {
  id: string
  nome: string
  status: string
  emoji?: string
}

export function useNotas() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['graphnexus-notas', user?.id],
    queryFn: async (): Promise<NotaResumida[]> => {
      if (!user) return []
      const { data } = await supabase
        .from('notes')
        .select('id, title, content, emoji, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('updated_at', { ascending: false })
        .limit(50)
      return (data ?? []).map((row: any) => ({
        id: row.id,
        titulo: row.title,
        preview: String(row.content ?? '').replace(/<[^>]+>/g, '').slice(0, 80),
        emoji: row.emoji ?? undefined,
        criadoEm: row.created_at,
      }))
    },
    enabled: !!user,
    staleTime: 0,
  })
}

export function useTarefas() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['graphnexus-tarefas', user?.id],
    queryFn: async (): Promise<TarefaResumida[]> => {
      if (!user) return []
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []).map((row: any) => ({
        id: row.id,
        titulo: row.title,
        status: row.status,
        prioridade: row.priority ?? undefined,
        dataVencimento: row.due_date ?? undefined,
      }))
    },
    enabled: !!user,
    staleTime: 0,
  })
}

export function useProjetos() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['graphnexus-projetos', user?.id],
    queryFn: async (): Promise<ProjetoResumido[]> => {
      if (!user) return []
      const { data } = await supabase
        .from('projects')
        .select('id, title, status, emoji')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(30)
      return (data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.title,
        status: row.status,
        emoji: row.emoji ?? undefined,
      }))
    },
    enabled: !!user,
    staleTime: 0,
  })
}
