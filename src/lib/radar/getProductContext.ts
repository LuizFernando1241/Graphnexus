import { supabase } from '@/integrations/supabase/client'
import { calcularScore, DEFAULT_PARAMETROS } from './radarScore'
import type { ProductContext, RadarProduto, PipelineStage, DecisionBadge, StatusCompra } from '@/types/radar'

/**
 * Agrega todo o contexto de um produto para uso futuro pela IA.
 * Esta função não é usada na UI ainda — é a fundação para o módulo de IA.
 */
export async function getProductContext(
  produtoId: string,
  userId: string
): Promise<ProductContext | null> {
  const { data: produtoRow } = await supabase
    .from('radar_produtos')
    .select('*')
    .eq('id', produtoId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!produtoRow) return null

  const produto: RadarProduto = {
    id: produtoRow.id,
    userId: produtoRow.user_id,
    nome: produtoRow.nome,
    fornecedor: produtoRow.fornecedor,
    linkML: produtoRow.link_ml ?? undefined,
    precoVenda: produtoRow.preco_venda ?? undefined,
    custo: produtoRow.custo ?? undefined,
    margem: produtoRow.margem ?? undefined,
    visitasMes: produtoRow.visitas_mes ?? undefined,
    vendasMes: produtoRow.vendas_mes ?? undefined,
    concorrentesFull: produtoRow.concorrentes_full ?? undefined,
    isLancamento: produtoRow.is_lancamento ?? false,
    observacoes: produtoRow.observacoes ?? undefined,
    stage: produtoRow.stage as PipelineStage,
    decisaoMotivo: produtoRow.decisao_motivo ?? undefined,
    quantidadePedir: produtoRow.quantidade_pedir ?? undefined,
    statusCompra: (produtoRow.status_compra ?? 'a_comprar') as StatusCompra,
    scoreTotal: produtoRow.score_total ?? 0,
    decision: (produtoRow.decision ?? 'descarte') as DecisionBadge,
    stageEnteredAt: produtoRow.stage_entered_at,
    createdAt: produtoRow.created_at,
    updatedAt: produtoRow.updated_at,
  }

  const { data: historico } = await supabase
    .from('radar_historico')
    .select('*')
    .eq('produto_id', produtoId)
    .order('timestamp', { ascending: true })

  const movimentacoes = (historico ?? []).filter((h: any) => h.field === 'stage')
  const timeInStages: { stage: PipelineStage; days: number }[] = []

  for (let i = 0; i < movimentacoes.length; i++) {
    const entrada = new Date((movimentacoes[i] as any).timestamp)
    const saida = movimentacoes[i + 1]
      ? new Date((movimentacoes[i + 1] as any).timestamp)
      : new Date()
    const dias = Math.floor((saida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24))
    timeInStages.push({ stage: (movimentacoes[i] as any).new_value as PipelineStage, days: dias })
  }

  const { data: links } = await supabase
    .from('radar_entity_links')
    .select('*')
    .eq('produto_id', produtoId)

  const { data: relacionados } = await supabase
    .from('radar_produtos')
    .select('id, nome, fornecedor, score_total, decision')
    .eq('user_id', userId)
    .eq('fornecedor', produto.fornecedor)
    .neq('id', produtoId)

  const signals: string[] = []
  const diasNaEtapa = Math.floor(
    (Date.now() - new Date(produto.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diasNaEtapa > 5) signals.push(`Parado na etapa "${produto.stage}" há ${diasNaEtapa} dias`)
  if (produto.stage === 'decisao' && diasNaEtapa > 3) signals.push('Decisão pendente há mais de 3 dias — requer atenção')
  if (produto.concorrentesFull === 0) signals.push('Nenhum concorrente no Full — oportunidade ou falta de demanda')
  if (produto.scoreTotal >= 40) signals.push('Score excelente — produto prioritário')

  const scoreResult = calcularScore(produto, DEFAULT_PARAMETROS)

  const linksList = (links ?? []) as any[]
  const projectLink = linksList.find((l) => l.entity_type === 'project')

  return {
    produto,
    scoreResult,
    scoreHistory: [],
    timeInStages,
    linkedNotes: linksList
      .filter((l) => l.entity_type === 'note')
      .map((l) => ({ id: l.entity_id, title: '', preview: '', createdAt: l.created_at })),
    linkedTasks: linksList
      .filter((l) => l.entity_type === 'task')
      .map((l) => ({ id: l.entity_id, title: '', status: '', dueDate: undefined })),
    linkedProject: projectLink ? { id: projectLink.entity_id, name: '' } : null,
    relatedProducts: (relacionados ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      fornecedor: r.fornecedor,
      score: r.score_total,
      decision: r.decision as DecisionBadge,
    })),
    signals,
  }
}
