import type {
  RadarProduto,
  RadarParametros,
  ScoreResult,
  PilarResult,
  DecisionBadge,
  RadarWeights,
  RadarFaixas,
  FaixaItem,
  PipelineStage,
  PilarExtra,
  RegraDescarteCustom,
} from '@/types/radar'
import { evalFormula } from './radarFormula'

// ─── Faixas padrão (editáveis em Parâmetros) ─────────────────────────────────

export const DEFAULT_FAIXAS: RadarFaixas = {
  margem: [
    { limiteMin: 20, pontos: 10, escalaAberta: true, label: '≥ 20%' },
    { limiteMin: 15, pontos: 8, label: '≥ 15%' },
    { limiteMin: 10, pontos: 5, label: '≥ 10%' },
    { limiteMin: 5, pontos: 3, label: '≥ 5%' },
    { limiteMin: 0, pontos: 0, label: '< 5%' },
  ],
  ticket: [
    { limiteMin: 500, pontos: 10, escalaAberta: true, label: '≥ R$ 500' },
    { limiteMin: 200, pontos: 8, label: '≥ R$ 200' },
    { limiteMin: 79, pontos: 6, label: '≥ R$ 79' },
    { limiteMin: 30, pontos: 3, label: '≥ R$ 30' },
    { limiteMin: 0, pontos: 0, descarte: true, label: '< R$ 30 (descarte)' },
  ],
  demanda: [
    { limiteMin: 5000, pontos: 10, escalaAberta: true, label: '≥ R$ 5.000/mês' },
    { limiteMin: 2000, pontos: 8, label: '≥ R$ 2.000/mês' },
    { limiteMin: 1000, pontos: 5, label: '≥ R$ 1.000/mês' },
    { limiteMin: 500, pontos: 3, label: '≥ R$ 500/mês' },
    { limiteMin: 0, pontos: 0, label: '< R$ 500/mês' },
  ],
  visitas: [
    { limiteMin: 1500, pontos: 10, escalaAberta: true, label: '≥ 1.500 visitas' },
    { limiteMin: 1000, pontos: 8, label: '≥ 1.000 visitas' },
    { limiteMin: 600, pontos: 5, label: '≥ 600 visitas' },
    { limiteMin: 450, pontos: 3, label: '≥ 450 visitas' },
    { limiteMin: 0, pontos: 0, label: '< 450 visitas' },
  ],
  concorrentes: [
    { limiteMax: 0, pontos: 15, label: '0 concorrentes' },
    { limiteMax: 1, pontos: 10, label: '1 concorrente' },
    { limiteMax: 3, pontos: 8, label: '2 a 3' },
    { limiteMax: 5, pontos: 5, label: '4 a 5' },
    { limiteMax: 8, pontos: 3, label: '6 a 8' },
    { limiteMin: 9, pontos: 0, label: '≥ 9 (saturado)' },
  ],
}

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
  faixas: DEFAULT_FAIXAS,
  pilaresExtras: [],
  descartesExtras: [],
  pilaresVisibilidade: {},
}

export const PESO_BASE = 20

// Chaves reservadas do sistema — não podem ser usadas como key de pilar customizado
// pois colidem com variáveis canônicas do produto e quebrariam regras de descarte/fórmulas.
export const RESERVED_VAR_KEYS = [
  'precoVenda',
  'custo',
  'margem',
  'visitasMes',
  'vendasMes',
  'concorrentesFull',
  'faturamento',
  'ticket',
] as const

// Mapa canônico de variáveis disponíveis em fórmulas.
// IMPORTANTE: o spread de valoresCustom vem PRIMEIRO para que campos canônicos
// sempre vençam sobre chaves customizadas homônimas (defesa em profundidade
// contra colisão de chaves — a validação no UI já bloqueia isso na criação).
export function buildVarMap(
  produto: Partial<RadarProduto>,
): Record<string, number> {
  const faturamento =
    produto.vendasMes != null && produto.precoVenda != null
      ? produto.vendasMes * produto.precoVenda
      : 0
  const vc = produto.valoresCustom ?? {}
  return {
    ...Object.fromEntries(
      Object.entries(vc).map(([k, v]) => [k, typeof v === 'number' ? v : 0]),
    ),
    precoVenda: produto.precoVenda ?? 0,
    custo: produto.custo ?? 0,
    margem: produto.margem ?? 0,
    visitasMes: produto.visitasMes ?? 0,
    vendasMes: produto.vendasMes ?? 0,
    concorrentesFull: produto.concorrentesFull ?? 0,
    faturamento,
    ticket: produto.precoVenda ?? 0,
  }
}


// ─── Avaliador genérico de faixas ────────────────────────────────────────────

interface AvaliacaoFaixa {
  pontos: number
  descarte: boolean
  faixaCasada?: FaixaItem
}

/**
 * Avalia um valor contra uma lista de faixas.
 * - Faixas com `limiteMin` (maior é melhor) → ordenadas desc, casa a primeira em que valor >= limiteMin.
 * - Faixas com `limiteMax` (menor é melhor) → ordenadas asc, casa a primeira em que valor <= limiteMax.
 * - Se a faixa casada tem `escalaAberta`, pontos = pontos * (valor / limiteMin).
 */
function avaliarFaixa(
  valor: number,
  faixas: FaixaItem[],
  direcaoExplicita?: 'min' | 'max',
): AvaliacaoFaixa {
  if (!faixas || faixas.length === 0) return { pontos: 0, descarte: false }

  const usaLimiteMax =
    direcaoExplicita === 'max' ||
    (direcaoExplicita === undefined &&
      faixas.some((f) => f.limiteMax != null) &&
      !faixas.every((f) => f.limiteMin != null && f.limiteMin > 0))

  if (usaLimiteMax) {
    const ordenadas = [...faixas].sort((a, b) => {
      const aMax = a.limiteMax ?? Infinity
      const bMax = b.limiteMax ?? Infinity
      return aMax - bMax
    })
    for (const f of ordenadas) {
      if (f.limiteMax != null && valor <= f.limiteMax) {
        return { pontos: f.pontos, descarte: !!f.descarte, faixaCasada: f }
      }
    }
    const fallback = ordenadas.find((f) => f.limiteMax == null)
    if (fallback) return { pontos: fallback.pontos, descarte: !!fallback.descarte, faixaCasada: fallback }
    return { pontos: 0, descarte: false }
  }

  const ordenadas = [...faixas].sort((a, b) => (b.limiteMin ?? 0) - (a.limiteMin ?? 0))
  for (const f of ordenadas) {
    const limite = f.limiteMin ?? 0
    if (valor >= limite) {
      let pontos = f.pontos
      if (f.escalaAberta && limite > 0) {
        pontos = f.pontos * (valor / limite)
      }
      return { pontos, descarte: !!f.descarte, faixaCasada: f }
    }
  }
  return { pontos: 0, descarte: false }
}

export { avaliarFaixa }

// ─── Merge das faixas configuradas com os defaults ──────────────────────────

function resolverFaixas(custom?: Partial<RadarFaixas>): RadarFaixas {
  return {
    margem: custom?.margem?.length ? custom.margem : DEFAULT_FAIXAS.margem,
    ticket: custom?.ticket?.length ? custom.ticket : DEFAULT_FAIXAS.ticket,
    demanda: custom?.demanda?.length ? custom.demanda : DEFAULT_FAIXAS.demanda,
    visitas: custom?.visitas?.length ? custom.visitas : DEFAULT_FAIXAS.visitas,
    concorrentes: custom?.concorrentes?.length ? custom.concorrentes : DEFAULT_FAIXAS.concorrentes,
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

export function calcularScore(
  produto: Partial<RadarProduto>,
  params: RadarParametros = DEFAULT_PARAMETROS
): ScoreResult {
  const alertas: string[] = []
  const faixas = resolverFaixas(params.faixas)

  const faturamentoEstimado =
    produto.vendasMes != null && produto.precoVenda != null
      ? produto.vendasMes * produto.precoVenda
      : undefined

  // ── Descartes automáticos por valores absolutos (autoDescarte) ──
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

  // ── Avaliar cada pilar via engine genérica ──
  const margemPreenchida = produto.margem != null
  const demandaAtiva = !produto.isLancamento && produto.vendasMes != null

  type PilarInput = {
    key: keyof RadarWeights
    nome: string
    preenchido: boolean
    valor: number | null
  }

  const inputs: PilarInput[] = [
    {
      key: 'margem',
      nome: 'Margem de Lucro',
      preenchido: margemPreenchida,
      valor: margemPreenchida ? produto.margem! : null,
    },
    {
      key: 'ticket',
      nome: 'Ticket Médio',
      preenchido: produto.precoVenda != null,
      valor: produto.precoVenda ?? null,
    },
    {
      key: 'demanda',
      nome: 'Demanda / Faturamento',
      preenchido: demandaAtiva,
      valor: demandaAtiva && faturamentoEstimado != null ? faturamentoEstimado : null,
    },
    {
      key: 'visitas',
      nome: 'Visitas por Mês',
      preenchido: produto.visitasMes != null,
      valor: produto.visitasMes ?? null,
    },
    {
      key: 'concorrentes',
      nome: 'Concorrentes no Full',
      preenchido: produto.concorrentesFull != null,
      valor: produto.concorrentesFull ?? null,
    },
  ]

  const visibilidade = params.pilaresVisibilidade ?? {}
  const isAtivo = (p: PilarInput) => {
    if (visibilidade[p.key] === false) return false
    if (p.key === 'margem' && !margemPreenchida) return false
    if (p.key === 'demanda' && produto.isLancamento) return false
    return true
  }

  let descarteByFaixa: { motivo: string } | null = null

  const pilares: PilarResult[] = inputs
    .filter((p) => visibilidade[p.key] !== false)
    .map((p) => {
      const peso = params.weights[p.key] ?? 0
      const ativo = isAtivo(p)
      const aval = p.valor != null ? avaliarFaixa(p.valor, faixas[p.key]) : { pontos: 0, descarte: false }

      if (ativo && aval.descarte && !descarteByFaixa) {
        descarteByFaixa = { motivo: `${p.nome}: valor em faixa de descarte` }
      }

      const multiplicador = peso / PESO_BASE
      const contribuicao = ativo ? aval.pontos * multiplicador : 0

      return {
        nome: p.nome,
        key: p.key,
        preenchido: p.preenchido,
        pontos: aval.pontos,
        pontosBrutos: aval.pontos,
        peso,
        pesoNormalizado: peso,
        contribuicao,
        valor: p.valor,
      }
    })

  // ── Pilares personalizados ──
  const extras = (params.pilaresExtras ?? []).filter((e) => e.ativo)
  const varMap = buildVarMap(produto)

  for (const extra of extras) {
    let valor: number | null = null
    let preenchido = false
    if (extra.tipo === 'formula') {
      valor = evalFormula(extra.formula ?? '', varMap)
      preenchido = valor != null
    } else {
      const raw = produto.valoresCustom?.[extra.key]
      if (typeof raw === 'number' && isFinite(raw)) {
        valor = raw
        preenchido = true
      }
    }

    const aval =
      valor != null
        ? avaliarFaixa(valor, extra.faixas ?? [], extra.direcao)
        : { pontos: 0, descarte: false }

    if (aval.descarte && !descarteByFaixa) {
      descarteByFaixa = { motivo: `${extra.label}: valor em faixa de descarte` }
    }

    const multiplicador = (extra.peso ?? 0) / PESO_BASE
    const contribuicao = preenchido ? aval.pontos * multiplicador : 0

    pilares.push({
      nome: extra.label,
      key: extra.key,
      preenchido,
      pontos: aval.pontos,
      pontosBrutos: aval.pontos,
      peso: extra.peso ?? 0,
      pesoNormalizado: extra.peso ?? 0,
      contribuicao,
      isCustom: true,
      valor,
    })
  }

  // ── Descartes customizados ──
  const descartesExtras: RegraDescarteCustom[] = params.descartesExtras ?? []
  for (const regra of descartesExtras) {
    if (regra.ativo === false) continue
    if (regra.ignorarLancamento && produto.isLancamento) continue
    const valor = varMap[regra.campo]
    if (typeof valor !== 'number') continue
    const match =
      (regra.operador === '<' && valor < regra.valor) ||
      (regra.operador === '<=' && valor <= regra.valor) ||
      (regra.operador === '>' && valor > regra.valor) ||
      (regra.operador === '>=' && valor >= regra.valor) ||
      (regra.operador === '==' && valor === regra.valor)
    if (match && !descarteByFaixa) {
      descarteByFaixa = {
        motivo:
          regra.motivo ??
          `${regra.campo} ${regra.operador} ${regra.valor}: descarte automático`,
      }
      break
    }
  }

  if (descarteByFaixa) {
    return {
      scoreTotal: 0,
      decision: 'descarte',
      pilares,
      faturamentoEstimado,
      descarteAutomatico: true,
      motivoDescarte: descarteByFaixa.motivo,
      alertas,
    }
  }

  const scoreTotal = pilares.reduce((sum, p) => sum + p.contribuicao, 0)

  let decision: DecisionBadge = 'descarte'
  if (scoreTotal >= params.decisaoThresholds.excelente) decision = 'excelente'
  else if (scoreTotal >= params.decisaoThresholds.viavel) decision = 'viavel'
  else if (scoreTotal >= params.decisaoThresholds.cautela) decision = 'cautela'

  return {
    scoreTotal: Math.round(scoreTotal * 100) / 100,
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
