import type {
  RadarProduto,
  RadarParametros,
  ScoreResult,
  PilarResult,
  DecisionBadge,
  RadarWeights,
  PipelineStage,
} from '@/types/radar'

// ─── Parâmetros padrão ────────────────────────────────────────────────────────

export const DEFAULT_PARAMETROS: RadarParametros = {
  weights: {
    margem: 20,
    ticket: 20,
    demanda: 20,
    visitas: 20,
    concorrentes: 20,
  },
  decisaoThresholds: {
    cautela: 20,
    viavel: 30,
    excelente: 40,
  },
  autoDescarte: {
    ticketMinimo: 30,
    faturamentoMinimo: 100,
  },
  faixas: {},
}

// ─── Pontuação dos pilares ────────────────────────────────────────────────────

function calcularPilarMargem(margem: number): number {
  if (margem >= 20) return 10 * (margem / 20)
  if (margem >= 12.5) return 8
  if (margem >= 10) return 6
  if (margem >= 5) return 3
  return 0
}

function calcularPilarTicket(preco: number): number {
  if (preco >= 500) return 10 * (preco / 500)
  if (preco >= 200) return 8
  if (preco >= 79) return 6
  if (preco >= 30) return 3
  return 0
}

function calcularPilarDemanda(faturamento: number): number {
  if (faturamento >= 5000) return 10 * (faturamento / 5000)
  if (faturamento >= 2000) return 8
  if (faturamento >= 1000) return 6
  if (faturamento >= 500) return 3
  return 0
}

function calcularPilarVisitas(visitas: number): number {
  if (visitas >= 1500) return 10 * (visitas / 1500)
  if (visitas >= 1000) return 8
  if (visitas >= 600) return 6
  if (visitas >= 450) return 3
  return 0
}

function calcularPilarConcorrentes(concorrentes: number): number {
  if (concorrentes === 0) return 15
  if (concorrentes === 1) return 10
  if (concorrentes <= 3) return 8
  if (concorrentes <= 5) return 5
  if (concorrentes <= 8) return 3
  return 0
}

// ─── Função principal ─────────────────────────────────────────────────────────

export function calcularScore(
  produto: Partial<RadarProduto>,
  params: RadarParametros = DEFAULT_PARAMETROS
): ScoreResult {
  const alertas: string[] = []
  const faturamentoEstimado =
    produto.vendasMes != null && produto.precoVenda != null
      ? produto.vendasMes * produto.precoVenda
      : undefined

  // ── Verificar descartes automáticos ──
  if (
    produto.precoVenda != null &&
    produto.precoVenda < params.autoDescarte.ticketMinimo
  ) {
    return {
      scoreTotal: 0,
      decision: 'descarte',
      pilares: [],
      faturamentoEstimado,
      descarteAutomatico: true,
      motivoDescarte: `Preço abaixo do mínimo de R$ ${params.autoDescarte.ticketMinimo}`,
      alertas: [`Preço de venda abaixo do mínimo configurado (R$ ${params.autoDescarte.ticketMinimo})`],
    }
  }

  if (
    !produto.isLancamento &&
    faturamentoEstimado != null &&
    faturamentoEstimado < params.autoDescarte.faturamentoMinimo
  ) {
    return {
      scoreTotal: 0,
      decision: 'descarte',
      pilares: [],
      faturamentoEstimado,
      descarteAutomatico: true,
      motivoDescarte: `Faturamento estimado abaixo do mínimo de R$ ${params.autoDescarte.faturamentoMinimo}/mês`,
      alertas: [`Faturamento estimado abaixo do mínimo configurado (R$ ${params.autoDescarte.faturamentoMinimo}/mês)`],
    }
  }

  // ── Alertas informativos ──
  if (produto.concorrentesFull === 0) {
    alertas.push('Nenhum concorrente no Full — verifique se há demanda real antes de avançar')
  }

  if (
    produto.vendasMes != null &&
    produto.visitasMes != null &&
    produto.vendasMes > produto.visitasMes
  ) {
    alertas.push('Vendas maiores que visitas — verifique os dados')
  }

  // ── Calcular pontos brutos de cada pilar ──
  const margemPreenchida = produto.margem != null
  const demandaAtiva = !produto.isLancamento && produto.vendasMes != null

  const pilaresData: Array<{
    key: keyof RadarWeights
    nome: string
    preenchido: boolean
    pontosBrutos: number
    peso: number
  }> = [
    {
      key: 'margem',
      nome: 'Margem de Lucro',
      preenchido: margemPreenchida,
      pontosBrutos: margemPreenchida ? calcularPilarMargem(produto.margem!) : 0,
      peso: params.weights.margem,
    },
    {
      key: 'ticket',
      nome: 'Ticket Médio',
      preenchido: produto.precoVenda != null,
      pontosBrutos: produto.precoVenda != null ? calcularPilarTicket(produto.precoVenda) : 0,
      peso: params.weights.ticket,
    },
    {
      key: 'demanda',
      nome: 'Demanda / Faturamento',
      preenchido: demandaAtiva,
      pontosBrutos:
        demandaAtiva && faturamentoEstimado != null
          ? calcularPilarDemanda(faturamentoEstimado)
          : 0,
      peso: params.weights.demanda,
    },
    {
      key: 'visitas',
      nome: 'Visitas por Mês',
      preenchido: produto.visitasMes != null,
      pontosBrutos: produto.visitasMes != null ? calcularPilarVisitas(produto.visitasMes) : 0,
      peso: params.weights.visitas,
    },
    {
      key: 'concorrentes',
      nome: 'Concorrentes no Full',
      preenchido: produto.concorrentesFull != null,
      pontosBrutos:
        produto.concorrentesFull != null
          ? calcularPilarConcorrentes(produto.concorrentesFull)
          : 0,
      peso: params.weights.concorrentes,
    },
  ]

  // ── Excluir pilares inativos e normalizar pesos ──
  const pilaresAtivos = pilaresData.filter((p) => {
    if (p.key === 'margem' && !margemPreenchida) return false
    if (p.key === 'demanda' && produto.isLancamento) return false
    return true
  })

  const totalPesoAtivo = pilaresAtivos.reduce((sum, p) => sum + p.peso, 0)

  // ── Montar resultado dos pilares ──
  const pilares: PilarResult[] = pilaresData.map((p) => {
    const ativo = pilaresAtivos.find((pa) => pa.key === p.key)
    const pesoNormalizado = ativo && totalPesoAtivo > 0 ? (p.peso / totalPesoAtivo) * 100 : 0
    const contribuicao = ativo ? (p.pontosBrutos * pesoNormalizado) / 100 : 0

    return {
      nome: p.nome,
      key: p.key,
      preenchido: p.preenchido,
      pontos: p.pontosBrutos,
      pontosBrutos: p.pontosBrutos,
      peso: p.peso,
      pesoNormalizado,
      contribuicao,
    }
  })

  // ── Score total ──
  const scoreTotal = pilares.reduce((sum, p) => sum + p.contribuicao, 0)

  // ── Decision ──
  let decision: DecisionBadge = 'descarte'
  if (scoreTotal >= params.decisaoThresholds.excelente) decision = 'excelente'
  else if (scoreTotal >= params.decisaoThresholds.viavel) decision = 'viavel'
  else if (scoreTotal >= params.decisaoThresholds.cautela) decision = 'cautela'

  return {
    scoreTotal: Math.round(scoreTotal * 10) / 10,
    decision,
    pilares,
    faturamentoEstimado,
    descarteAutomatico: false,
    alertas,
  }
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

export function getDecisionLabel(decision: DecisionBadge): string {
  const labels: Record<DecisionBadge, string> = {
    descarte: '❌ Descarte',
    cautela: '⚠️ Cautela',
    viavel: '✅ Viável',
    excelente: '🚀 Excelente',
  }
  return labels[decision]
}

export function getDecisionColor(decision: DecisionBadge): string {
  const colors: Record<DecisionBadge, string> = {
    descarte: '#EF4444',
    cautela: '#F59E0B',
    viavel: '#10B981',
    excelente: '#8B5CF6',
  }
  return colors[decision]
}

export function getStageLabel(stage: PipelineStage): string {
  const labels: Record<string, string> = {
    prospeccao: 'Prospecção',
    aguardando_custo: 'Aguardando Custo',
    decisao: 'Decisão',
    arquivado: 'Arquivado',
    aprovado: 'Aprovado',
  }
  return labels[stage] ?? stage
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
