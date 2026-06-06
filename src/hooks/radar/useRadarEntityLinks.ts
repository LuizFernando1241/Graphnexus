import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { RadarEntityLink, EntityLinkType } from '@/types/radar'

export function useRadarEntityLinks(produtoId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['radar-entity-links', produtoId],
    queryFn: async () => {
      if (!produtoId || !user) return []

      const { data, error } = await supabase
        .from('radar_entity_links')
        .select('*')
        .eq('produto_id', produtoId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map((row: any): RadarEntityLink => ({
        id: row.id,
        produtoId: row.produto_id,
        userId: row.user_id,
        entityType: row.entity_type as EntityLinkType,
        entityId: row.entity_id,
        createdAt: row.created_at,
      }))
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

      const { error } = await supabase.from('radar_entity_links').insert({
        produto_id: produtoId,
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-entity-links', produtoId] })
    },
  })

  const removerLink = useMutation({
    mutationFn: async (linkId: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('radar_entity_links')
        .delete()
        .eq('id', linkId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-entity-links', produtoId] })
    },
  })

  return {
    links: query.data ?? [],
    isLoading: query.isLoading,
    adicionarLink: adicionarLink.mutateAsync,
    removerLink: removerLink.mutateAsync,
  }
}
