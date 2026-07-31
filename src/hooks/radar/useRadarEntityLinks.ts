import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { fetchEntityLinks, createEntityLink, deleteEntityLink } from '@/lib/api/links'
import type { RadarEntityLink, EntityLinkType } from '@/types/radar'
import type { EntityLink } from '@/types/entities'

/**
 * Hook unificado: lê/grava na tabela global `entity_links` usando
 * source_type='product' (lado do produto). Compatível com LinkPanel/Graph.
 * Agora consome o sistema compartilhado de links (lib/api/links.ts).
 */
export function useRadarEntityLinks(produtoId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['entity-links', produtoId, 'product'],
    queryFn: async () => {
      if (!produtoId || !user) return []

      // Usa o sistema compartilhado para buscar links
      const entityLinks = await fetchEntityLinks(produtoId, 'product')

      // Transforma EntityLink[] → RadarEntityLink[]
      const out: RadarEntityLink[] = []
      for (const link of entityLinks) {
        const isSource = link.source_type === 'product' && link.source_id === produtoId
        const entityType = (isSource ? link.target_type : link.source_type) as EntityLinkType
        const entityId = isSource ? link.target_id : link.source_id
        if (!['note', 'task', 'project'].includes(entityType)) continue

        // Extrai user_id do link (se disponível na tabela)
        const userId = (link as any).user_id || user.id

        out.push({
          id: link.id,
          produtoId,
          userId,
          entityType,
          entityId,
          createdAt: link.created_at,
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

      // Insere user_id manualmente pois createEntityLink não injeta automaticamente
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
      // Usa deleteEntityLink do sistema compartilhado
      await deleteEntityLink(linkId)
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
