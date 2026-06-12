import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { calcularScore } from '@/lib/radar/radarScore'
import { useRadarParametros } from './useRadarParametros'
import { triggerEmbed } from '@/lib/api/embedding'
import type { RadarProduto, RadarProdutoFormData, PipelineStage, DecisionBadge, StatusCompra } from '@/types/radar'

// Mapper: Supabase row → RadarProduto
function mapRow(row: any): RadarProduto {
  return {
    id: row.id,
    userId: row.user_id,
    nome: row.nome,
    fornecedor: row.fornecedor,
    linkML: row.link_ml ?? undefined,
    precoVenda: row.preco_venda ?? undefined,
    custo: row.custo ?? undefined,
    margem: row.margem ?? undefined,
    visitasMes: row.visitas_mes ?? undefined,
    vendasMes: row.vendas_mes ?? undefined,
    concorrentesFull: row.concorrentes_full ?? undefined,
    isLancamento: row.is_lancamento ?? false,
    observacoes: row.observacoes ?? undefined,
    stage: row.stage as PipelineStage,
    decisaoMotivo: row.decisao_motivo ?? undefined,
    quantidadePedir: row.quantidade_pedir ?? undefined,
    statusCompra: (row.status_compra ?? 'a_comprar') as StatusCompra,
    scoreTotal: row.score_total ?? 0,
    decision: (row.decision ?? 'descarte') as DecisionBadge,
    stageEnteredAt: row.stage_entered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useRadarProdutos() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { parametros } = useRadarParametros()

  const query = useQuery({
    queryKey: ['radar-produtos', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('radar_produtos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(mapRow)
    },
    enabled: !!user,
  })

  const criarProduto = useMutation({
    mutationFn: async (formData: RadarProdutoFormData) => {
      if (!user) throw new Error('Usuário não autenticado')

      const scoreResult = calcularScore(formData, parametros)

      const { data, error } = await supabase
        .from('radar_produtos')
        .insert({
          user_id: user.id,
          nome: formData.nome,
          fornecedor: formData.fornecedor,
          link_ml: formData.linkML,
          preco_venda: formData.precoVenda,
          custo: formData.custo,
          margem: formData.margem,
          visitas_mes: formData.visitasMes,
          vendas_mes: formData.vendasMes,
          concorrentes_full: formData.concorrentesFull,
          is_lancamento: formData.isLancamento,
          observacoes: formData.observacoes,
          stage: 'prospeccao',
          score_total: scoreResult.scoreTotal,
          decision: scoreResult.decision,
          stage_entered_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('radar_historico').insert({
        produto_id: data.id,
        user_id: user.id,
        stage: 'prospeccao',
        event: 'Produto criado',
      })

      triggerEmbed('produto', data.id)
      return mapRow(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-produtos', user?.id] })
    },
  })

  const atualizarProduto = useMutation({
    mutationFn: async ({
      id,
      formData,
      produtoAtual,
    }: {
      id: string
      formData: Partial<RadarProdutoFormData>
      produtoAtual: RadarProduto
    }) => {
      if (!user) throw new Error('Usuário não autenticado')

      const produtoMerged = { ...produtoAtual, ...formData }
      const scoreResult = calcularScore(produtoMerged, parametros)

      const { data, error } = await supabase
        .from('radar_produtos')
        .update({
          nome: formData.nome,
          fornecedor: formData.fornecedor,
          link_ml: formData.linkML,
          preco_venda: formData.precoVenda,
          custo: formData.custo,
          margem: formData.margem,
          visitas_mes: formData.visitasMes,
          vendas_mes: formData.vendasMes,
          concorrentes_full: formData.concorrentesFull,
          is_lancamento: formData.isLancamento,
          observacoes: formData.observacoes,
          score_total: scoreResult.scoreTotal,
          decision: scoreResult.decision,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      const camposMonitorados = [
        'nome', 'fornecedor', 'precoVenda', 'custo', 'margem',
        'visitasMes', 'vendasMes', 'concorrentesFull', 'isLancamento', 'observacoes',
      ]

      const historicoEntries = camposMonitorados
        .filter((campo) => {
          const chaveForm = campo as keyof RadarProdutoFormData
          return (
            formData[chaveForm] !== undefined &&
            String(formData[chaveForm]) !== String((produtoAtual as any)[campo])
          )
        })
        .map((campo) => ({
          produto_id: id,
          user_id: user.id,
          stage: produtoAtual.stage,
          event: `Campo alterado: ${campo}`,
          field: campo,
          old_value: String((produtoAtual as any)[campo] ?? ''),
          new_value: String((formData as any)[campo] ?? ''),
        }))

      if (historicoEntries.length > 0) {
        await supabase.from('radar_historico').insert(historicoEntries)
      }

      triggerEmbed('produto', id)
      return mapRow(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-produtos', user?.id] })
    },
  })

  const moverEtapa = useMutation({
    mutationFn: async ({
      id,
      novaEtapa,
      motivo,
      produtoAtual,
    }: {
      id: string
      novaEtapa: PipelineStage
      motivo?: string
      produtoAtual: RadarProduto
    }) => {
      if (!user) throw new Error('Usuário não autenticado')

      const agora = new Date().toISOString()

      const { data, error } = await supabase
        .from('radar_produtos')
        .update({
          stage: novaEtapa,
          stage_entered_at: agora,
          decisao_motivo: motivo,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      await supabase.from('radar_historico').insert({
        produto_id: id,
        user_id: user.id,
        stage: novaEtapa,
        event: `Movido para ${novaEtapa}`,
        field: 'stage',
        old_value: produtoAtual.stage,
        new_value: novaEtapa,
      })

      return mapRow(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-produtos', user?.id] })
    },
  })

  const atualizarStatusCompra = useMutation({
    mutationFn: async ({
      id,
      statusCompra,
      quantidadePedir,
    }: {
      id: string
      statusCompra?: StatusCompra
      quantidadePedir?: number
    }) => {
      if (!user) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('radar_produtos')
        .update({ status_compra: statusCompra, quantidade_pedir: quantidadePedir })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return mapRow(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-produtos', user?.id] })
    },
  })

  const recalcularTodos = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado')
      const produtos = query.data ?? []
      let atualizados = 0
      await Promise.all(
        produtos.map(async (p) => {
          const scoreResult = calcularScore(p, parametros)
          if (
            scoreResult.scoreTotal === p.scoreTotal &&
            scoreResult.decision === p.decision
          ) {
            return
          }
          const { error } = await supabase
            .from('radar_produtos')
            .update({
              score_total: scoreResult.scoreTotal,
              decision: scoreResult.decision,
            })
            .eq('id', p.id)
            .eq('user_id', user.id)
          if (!error) atualizados++
        }),
      )
      return atualizados
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-produtos', user?.id] })
    },
  })

  const deletarProduto = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado')
      const { error } = await supabase
        .from('radar_produtos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radar-produtos', user?.id] })
    },
  })

  return {
    produtos: query.data ?? [],
    isLoading: query.isLoading,
    criarProduto: criarProduto.mutateAsync,
    atualizarProduto: atualizarProduto.mutateAsync,
    moverEtapa: moverEtapa.mutateAsync,
    atualizarStatusCompra: atualizarStatusCompra.mutateAsync,
    recalcularTodos: recalcularTodos.mutateAsync,
    isRecalculando: recalcularTodos.isPending,
    deletarProduto: deletarProduto.mutateAsync,
    isDeletando: deletarProduto.isPending,
    isCriando: criarProduto.isPending,
    isAtualizando: atualizarProduto.isPending,
    isMovendo: moverEtapa.isPending,
  }
}

