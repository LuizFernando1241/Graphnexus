import type { RadarProduto, RadarParametros, PilarResult, PipelineStage, DecisionBadge } from '@/types/radar'
import { calcularScore, formatCurrency, getDecisionLabel, getStageLabel } from './radarScore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type ExportFieldCategory =
  | 'identificacao'
  | 'comercial'
  | 'pipeline'
  | 'pontuacao'
  | 'metadados'

export interface ExportField {
  id: string
  label: string
  category: ExportFieldCategory
  getValue: (produto: RadarProduto, scoreResult: PilarResult[]) => string | number
}

// ─── Campos estáticos (não dependem de parâmetros do usuário) ───

const IDENTIFICACAO_FIELDS: ExportField[] = [
  {
    id: 'nome',
    label: 'Nome',
    category: 'identificacao',
    getValue: (p) => p.nome,
  },
  {
    id: 'fornecedor',
    label: 'Fornecedor',
    category: 'identificacao',
    getValue: (p) => p.fornecedor,
  },
  {
    id: 'link_ml',
    label: 'Link ML',
    category: 'identificacao',
    getValue: (p) => p.linkML ?? '',
  },
]

const COMERCIAL_FIELDS: ExportField[] = [
  {
    id: 'preco_venda',
    label: 'Preço de Venda',
    category: 'comercial',
    getValue: (p) => p.precoVenda != null ? formatCurrency(p.precoVenda) : '',
  },
  {
    id: 'custo',
    label: 'Custo',
    category: 'comercial',
    getValue: (p) => p.custo != null ? formatCurrency(p.custo) : '',
  },
  {
    id: 'margem',
    label: 'Margem %',
    category: 'comercial',
    getValue: (p) => p.margem != null ? `${p.margem.toFixed(1)}%` : '',
  },
  {
    id: 'faturamento_estimado',
    label: 'Faturamento Estimado',
    category: 'comercial',
    getValue: (p) => {
      if (p.vendasMes != null && p.precoVenda != null) {
        return formatCurrency(p.vendasMes * p.precoVenda)
      }
      return ''
    },
  },
  {
    id: 'visitas_mes',
    label: 'Visitas/Mês',
    category: 'comercial',
    getValue: (p) => p.visitasMes != null ? p.visitasMes.toLocaleString('pt-BR') : '',
  },
  {
    id: 'vendas_mes',
    label: 'Vendas/Mês',
    category: 'comercial',
    getValue: (p) => p.vendasMes != null ? p.vendasMes.toLocaleString('pt-BR') : '',
  },
  {
    id: 'concorrentes_full',
    label: 'Concorrentes no Full',
    category: 'comercial',
    getValue: (p) => p.concorrentesFull != null ? String(p.concorrentesFull) : '',
  },
  {
    id: 'is_lancamento',
    label: 'É Lançamento',
    category: 'comercial',
    getValue: (p) => (p.isLancamento ? 'Sim' : 'Não'),
  },
]

const PIPELINE_FIELDS: ExportField[] = [
  {
    id: 'stage',
    label: 'Etapa',
    category: 'pipeline',
    getValue: (p) => getStageLabel(p.stage),
  },
  {
    id: 'status_compra',
    label: 'Status de Compra',
    category: 'pipeline',
    getValue: (p) => (p.statusCompra === 'comprado' ? 'Comprado' : 'A comprar'),
  },
  {
    id: 'quantidade_pedir',
    label: 'Quantidade a Pedir',
    category: 'pipeline',
    getValue: (p) => p.quantidadePedir != null ? String(p.quantidadePedir) : '',
  },
  {
    id: 'stage_entered_at',
    label: 'Data de Entrada na Etapa',
    category: 'pipeline',
    getValue: (p) => format(new Date(p.stageEnteredAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
  },
  {
    id: 'decisao_final',
    label: 'Decisão Final',
    category: 'pipeline',
    getValue: (p) => (p.decisaoFinal === 'aprovado' ? 'Aprovado' : p.decisaoFinal === 'reprovado' ? 'Reprovado' : ''),
  },
  {
    id: 'decisao_motivo',
    label: 'Motivo da Decisão',
    category: 'pipeline',
    getValue: (p) => p.decisaoMotivo ?? '',
  },
]

const PONTUACAO_BASE_FIELDS: ExportField[] = [
  {
    id: 'score_total',
    label: 'Score Total',
    category: 'pontuacao',
    getValue: (p) => p.scoreTotal,
  },
  {
    id: 'decision',
    label: 'Decisão',
    category: 'pontuacao',
    getValue: (p) => getDecisionLabel(p.decision),
  },
]

const METADADOS_FIELDS: ExportField[] = [
  {
    id: 'observacoes',
    label: 'Observações',
    category: 'metadados',
    getValue: (p) => p.observacoes ?? '',
  },
  {
    id: 'created_at',
    label: 'Criado em',
    category: 'metadados',
    getValue: (p) => format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
  },
  {
    id: 'updated_at',
    label: 'Atualizado em',
    category: 'metadados',
    getValue: (p) => format(new Date(p.updatedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
  },
]

// ─── Campos dinâmicos (pilares de pontuação) ───

function buildPilarFields(scoreResult: PilarResult[]): ExportField[] {
  return scoreResult.map((pilar) => ({
    id: `pilar_${pilar.key}`,
    label: `Score: ${pilar.nome}`,
    category: 'pontuacao' as const,
    getValue: () => pilar.pontos.toFixed(1),
  }))
}

// ─── Função principal para montar o catálogo completo ───

export function buildExportFields(
  produto: RadarProduto,
  parametros: RadarParametros
): ExportField[] {
  const scoreResult = calcularScore(produto, parametros)
  
  return [
    ...IDENTIFICACAO_FIELDS,
    ...COMERCIAL_FIELDS,
    ...PIPELINE_FIELDS,
    ...PONTUACAO_BASE_FIELDS,
    ...buildPilarFields(scoreResult.pilares),
    ...METADADOS_FIELDS,
  ]
}

// ─── Categorias (para agrupamento visual no diálogo) ───

export const EXPORT_CATEGORIES: Record<
  ExportFieldCategory,
  { label: string; order: number }
> = {
  identificacao: { label: 'Identificação', order: 1 },
  comercial: { label: 'Comercial', order: 2 },
  pipeline: { label: 'Pipeline', order: 3 },
  pontuacao: { label: 'Pontuação', order: 4 },
  metadados: { label: 'Metadados', order: 5 },
}

// ─── IDs padrão (todos marcados na primeira vez) ───

export function getDefaultFieldIds(
  produto: RadarProduto,
  parametros: RadarParametros
): string[] {
  return buildExportFields(produto, parametros).map((f) => f.id)
}
