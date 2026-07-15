import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { DEFAULT_PARAMETROS } from '@/lib/radar/radarScore'
import type { RadarParametros } from '@/types/radar'

export function useRadarParametros() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['radar-parametros', user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_PARAMETROS

      const { data, error } = await supabase
        .from('radar_parametros')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) return DEFAULT_PARAMETROS

      return {
        id: data.id,
        userId: data.user_id,
        weights: data.weights as RadarParametros['weights'],
        decisaoThresholds: data.decisao_thresholds as RadarParametros['decisaoThresholds'],
        autoDescarte: data.auto_descarte as RadarParametros['autoDescarte'],
        faixas: (data.faixas ?? {}) as RadarParametros['faixas'],
        pilaresExtras: ((data as any).pilares_extras ?? []) as RadarParametros['pilaresExtras'],
        descartesExtras: ((data as any).descartes_extras ?? []) as RadarParametros['descartesExtras'],
        pilaresVisibilidade: ((data as any).pilares_visibilidade ?? {}) as RadarParametros['pilaresVisibilidade'],
      } as RadarParametros
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })

  const mutation = useMutation({
    mutationFn: async (params: RadarParametros) => {
      if (!user) throw new Error('Usuário não autenticado')

      const { error } = await supabase.from('radar_parametros').upsert(
        {
          user_id: user.id,
          weights: params.weights as any,
          decisao_thresholds: params.decisaoThresholds as any,
          auto_descarte: params.autoDescarte as any,
          faixas: params.faixas as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-parametros', user?.id] })
    },
  })

  return {
    parametros: query.data ?? DEFAULT_PARAMETROS,
    isLoading: query.isLoading,
    saveParametros: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}
