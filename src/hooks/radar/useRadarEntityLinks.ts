import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { RadarEntityLink, EntityLinkType } from '@/types/radar'

/**
 * Hook unificado: lê/grava na tabela global `entity_links` usando
 * source_type='product' (lado do produto). Compatível com LinkPanel/Graph.
 */
export function useRadarEntityLinks(produtoId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['entity-links', produtoId, 'product'],
    queryFn: async () => {
      if (!produtoId || !user) return []

      // Busca em ambos os lados (produto como source ou como target)
      const [sourceRes, targetRes] = await Promise.all([
        supabase
          .from('entity_links')
          .select('*')
          .eq('source_type', 'product')
          .eq('source_id', produtoId),
        supabase
          .from('entity_links')
          .select('*')
          .eq('target_type', 'product')
          .eq('target_id', produtoId),
      ])

      if (sourceRes.error) throw sourceRes.error
      if (targetRes.error) throw targetRes.error

      const rows = [...(sourceRes.data ?? []), ...(targetRes.data ?? [])]
      const seen = new Set<string>()
      const out: RadarEntityLink[] = []
      for (const row of rows) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        const isSource = row.source_type === 'product' && row.source_id === produtoId
        const entityType = (isSource ? row.target_type : row.source_type) as EntityLinkType
        const entityId = isSource ? row.target_id : row.source_id
        if (!['note', 'task', 'project'].includes(entityType)) continue
        out.push({
          id: row.id,
          produtoId,
          userId: row.user_id,
          entityType,
          entityId,
          createdAt: row.created_at,
        })
      }
      return out
    },
    enabled: !!produtoId && !!user,
  })

  const adicionarLink = useMutation({
    mutationFn: async ({
      entityType,
      entityId,
    }: {
      entityType: EntityLinkType
      entityId: string
    }) => {
      if (!produtoId || !user) throw new Error('Dados inválidos')

      const { error } = await supabase.from('entity_links').insert({
        user_id: user.id,
        source_type: 'product',
        source_id: produtoId,
        target_type: entityType,
        target_id: entityId,
      })

      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['entity-links', produtoId, 'product'] })
      queryClient.invalidateQueries({ queryKey: ['entity-links', vars.entityId, vars.entityType] })
      queryClient.invalidateQueries({ queryKey: ['graph-data'] })
    },
  })

  const removerLink = useMutation({
    mutationFn: async (linkId: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('entity_links')
        .delete()
        .eq('id', linkId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-links'] })
      queryClient.invalidateQueries({ queryKey: ['graph-data'] })
    },
  })

  return {
    links: query.data ?? [],
    isLoading: query.isLoading,
    adicionarLink: adicionarLink.mutateAsync,
    removerLink: removerLink.mutateAsync,
  }
}
