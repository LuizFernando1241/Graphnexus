import type { RadarProduto } from '@/types/radar'
import { formatCurrency, getDecisionLabel } from './radarScore'

export function exportarAprovadosCSV(produtos: RadarProduto[]): void {
  const aprovados = produtos.filter((p) => p.stage === 'aprovado')

  const headers = [
    'Nome', 'Fornecedor', 'Preço de Venda', 'Custo',
    'Margem (%)', 'Score', 'Decisão', 'Status',
    'Quantidade a Pedir', 'Data de Aprovação',
  ]

  const rows = aprovados.map((p) => [
    p.nome,
    p.fornecedor,
    p.precoVenda != null ? formatCurrency(p.precoVenda) : '',
    p.custo != null ? formatCurrency(p.custo) : '',
    p.margem != null ? `${p.margem}%` : '',
    String(p.scoreTotal),
    getDecisionLabel(p.decision),
    p.statusCompra === 'comprado' ? 'Comprado' : 'A comprar',
    p.quantidadePedir != null ? String(p.quantidadePedir) : '',
    new Date(p.stageEnteredAt).toLocaleDateString('pt-BR'),
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `radar-aprovados-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
