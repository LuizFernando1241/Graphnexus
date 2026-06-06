import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { RadarHistorico, PipelineStage } from '@/types/radar'

export function useRadarHistorico(produtoId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['radar-historico', produtoId],
    queryFn: async () => {
      if (!produtoId || !user) return []

      const { data, error } = await supabase
        .from('radar_historico')
        .select('*')
        .eq('produto_id', produtoId)
        .order('timestamp', { ascending: false })

      if (error) throw error

      return (data ?? []).map((row: any): RadarHistorico => ({
        id: row.id,
        produtoId: row.produto_id,
        userId: row.user_id,
        timestamp: row.timestamp,
        stage: row.stage as PipelineStage,
        event: row.event,
        field: row.field ?? undefined,
        oldValue: row.old_value ?? undefined,
        newValue: row.new_value ?? undefined,
      }))
    },
    enabled: !!produtoId && !!user,
  })
}
