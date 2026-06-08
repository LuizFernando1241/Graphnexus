// ─── Enums ───────────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'prospeccao'
  | 'aguardando_custo'
  | 'decisao'
  | 'arquivado'
  | 'aprovado'

export type DecisionBadge = 'descarte' | 'cautela' | 'viavel' | 'excelente'

export type EntityLinkType = 'note' | 'task' | 'project'

export type StatusCompra = 'a_comprar' | 'comprado'

// ─── Entidade principal ───────────────────────────────────────────────────────

export interface RadarProduto {
  id: string
  userId: string
  nome: string
  fornecedor: string
  linkML?: string
  precoVenda?: number
  custo?: number
  margem?: number
  visitasMes?: number
  vendasMes?: number
  concorrentesFull?: number
  isLancamento: boolean
  observacoes?: string
  stage: PipelineStage
  decisaoMotivo?: string
  quantidadePedir?: number
  statusCompra: StatusCompra
  scoreTotal: number
  decision: DecisionBadge
  stageEnteredAt: string
  createdAt: string
  updatedAt: string
}

// ─── Histórico ────────────────────────────────────────────────────────────────

export interface RadarHistorico {
  id: string
  produtoId: string
  userId: string
  timestamp: string
  stage: PipelineStage
  event: string
  field?: string
  oldValue?: string
  newValue?: string
}

// ─── Parâmetros ───────────────────────────────────────────────────────────────

export interface RadarWeights {
  margem: number
  ticket: number
  demanda: number
  visitas: number
  concorrentes: number
}

export interface RadarDecisaoThresholds {
  cautela: number
  viavel: number
  excelente: number
}

export interface RadarAutoDescarte {
  ticketMinimo: number
  faturamentoMinimo: number
}

export interface FaixaItem {
  limiteMin?: number
  limiteMax?: number
  pontos: number
  label?: string
  escalaAberta?: boolean
  descarte?: boolean
}

export interface RadarFaixas {
  margem: FaixaItem[]
  ticket: FaixaItem[]
  demanda: FaixaItem[]
  visitas: FaixaItem[]
  concorrentes: FaixaItem[]
}

export interface RadarParametros {
  id?: string
  userId?: string
  weights: RadarWeights
  decisaoThresholds: RadarDecisaoThresholds
  autoDescarte: RadarAutoDescarte
  faixas: Partial<RadarFaixas>
}

// ─── Score ────────────────────────────────────────────────────────────────────

export interface PilarResult {
  nome: string
  key: keyof RadarWeights
  preenchido: boolean
  pontos: number
  pontosBrutos: number
  peso: number
  pesoNormalizado: number
  contribuicao: number
}

export interface ScoreResult {
  scoreTotal: number
  decision: DecisionBadge
  pilares: PilarResult[]
  faturamentoEstimado?: number
  descarteAutomatico: boolean
  motivoDescarte?: string
  alertas: string[]
}

// ─── Links com GraphNexus ─────────────────────────────────────────────────────

export interface RadarEntityLink {
  id: string
  produtoId: string
  userId: string
  entityType: EntityLinkType
  entityId: string
  createdAt: string
}

// ─── Context para IA futura ───────────────────────────────────────────────────

export interface ProductContext {
  produto: RadarProduto
  scoreResult: ScoreResult
  scoreHistory: { date: string; score: number; decision: DecisionBadge }[]
  timeInStages: { stage: PipelineStage; days: number }[]
  linkedNotes: { id: string; title: string; preview: string; createdAt: string }[]
  linkedTasks: { id: string; title: string; status: string; dueDate?: string }[]
  linkedProject: { id: string; name: string } | null
  relatedProducts: { id: string; nome: string; fornecedor: string; score: number; decision: DecisionBadge }[]
  signals: string[]
}

// ─── Formulário ───────────────────────────────────────────────────────────────

export interface RadarProdutoFormData {
  nome: string
  fornecedor: string
  linkML?: string
  precoVenda?: number
  custo?: number
  margem?: number
  visitasMes?: number
  vendasMes?: number
  concorrentesFull?: number
  isLancamento: boolean
  observacoes?: string
}
