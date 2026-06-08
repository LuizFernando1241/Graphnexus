import type { RadarProduto } from '@/types/radar'
import { getDecisionLabel, getStageLabel } from './radarScore'

export type SinalTipo = 'atencao' | 'oportunidade' | 'risco' | 'info'

export interface Sinal {
  id: string
  tipo: SinalTipo
  titulo: string
  descricao: string
  produtoId: string
  produtoNome: string
  urgente: boolean
  timestamp: string
}

export function gerarSinais(produtos: RadarProduto[]): Sinal[] {
  const sinais: Sinal[] = []
  const agora = new Date()

  for (const produto of produtos) {
    if (produto.stage === 'aprovado') continue

    const diasNaEtapa = Math.floor(
      (agora.getTime() - new Date(produto.stageEnteredAt).getTime()) / 86400000,
    )

    if (produto.stage === 'decisao' && diasNaEtapa >= 3) {
      sinais.push({
        id: `decisao-${produto.id}`,
        tipo: 'atencao',
        titulo: 'Decisão pendente',
        descricao: `"${produto.nome}" está aguardando decisão há ${diasNaEtapa} dias.`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        urgente: diasNaEtapa >= 7,
        timestamp: produto.stageEnteredAt,
      })
    }

    if (produto.stage === 'aguardando_custo' && diasNaEtapa >= 5) {
      sinais.push({
        id: `aguardando-${produto.id}`,
        tipo: 'info',
        titulo: 'Aguardando resposta do fornecedor',
        descricao: `"${produto.nome}" está em negociação há ${diasNaEtapa} dias. Já fez um follow-up?`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        urgente: false,
        timestamp: produto.stageEnteredAt,
      })
    }

    if (
      produto.stage === 'prospeccao' &&
      produto.decision === 'excelente' &&
      diasNaEtapa >= 2
    ) {
      sinais.push({
        id: `excelente-${produto.id}`,
        tipo: 'oportunidade',
        titulo: 'Produto excelente sem avanço',
        descricao: `"${produto.nome}" tem score ${produto.scoreTotal.toFixed(1)} (Excelente) e está em Prospecção há ${diasNaEtapa} dias.`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        urgente: diasNaEtapa >= 5,
        timestamp: produto.stageEnteredAt,
      })
    }

    if (produto.concorrentesFull === 0 && produto.stage === 'prospeccao') {
      sinais.push({
        id: `sem-concorrente-${produto.id}`,
        tipo: 'oportunidade',
        titulo: 'Sem concorrentes no Full',
        descricao: `"${produto.nome}" não tem concorrentes no Full. Oportunidade real ou falta de demanda?`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        urgente: false,
        timestamp: produto.updatedAt,
      })
    }

    if (
      produto.stage === 'aguardando_custo' &&
      produto.margem != null &&
      produto.margem < 10
    ) {
      sinais.push({
        id: `margem-baixa-${produto.id}`,
        tipo: 'risco',
        titulo: 'Margem abaixo do recomendado',
        descricao: `"${produto.nome}" tem margem de ${produto.margem.toFixed(1)}% — abaixo de 10%. Revisar viabilidade.`,
        produtoId: produto.id,
        produtoNome: produto.nome,
        urgente: false,
        timestamp: produto.updatedAt,
      })
    }
  }

  return sinais.sort((a, b) => {
    if (a.urgente && !b.urgente) return -1
    if (!a.urgente && b.urgente) return 1
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
}

export function gerarContextoProduto(
  produto: RadarProduto,
  todosProdutos: RadarProduto[],
): string {
  const relacionados = todosProdutos.filter(
    (p) => p.fornecedor === produto.fornecedor && p.id !== produto.id,
  )
  const diasNaEtapa = Math.floor(
    (Date.now() - new Date(produto.stageEnteredAt).getTime()) / 86400000,
  )
  const faturamento =
    produto.vendasMes != null && produto.precoVenda != null
      ? produto.vendasMes * produto.precoVenda
      : null

  const linhas = [
    `PRODUTO: ${produto.nome}`,
    `FORNECEDOR: ${produto.fornecedor}`,
    `ETAPA: ${getStageLabel(produto.stage)} (há ${diasNaEtapa} dias)`,
    `SCORE: ${produto.scoreTotal.toFixed(1)} — ${getDecisionLabel(produto.decision)}`,
    ``,
    `DADOS DE MERCADO:`,
    produto.precoVenda != null
      ? `- Preço de venda: R$ ${produto.precoVenda.toFixed(2)}`
      : `- Preço de venda: não informado`,
    produto.margem != null
      ? `- Margem: ${produto.margem.toFixed(1)}%`
      : `- Margem: não informada`,
    produto.visitasMes != null
      ? `- Visitas/mês: ${produto.visitasMes}`
      : `- Visitas/mês: não informado`,
    produto.vendasMes != null
      ? `- Vendas/mês: ${produto.vendasMes}`
      : `- Vendas/mês: não informado`,
    faturamento != null
      ? `- Faturamento estimado: R$ ${faturamento.toFixed(2)}/mês`
      : null,
    produto.concorrentesFull != null
      ? `- Concorrentes no Full: ${produto.concorrentesFull}`
      : `- Concorrentes no Full: não informado`,
    produto.isLancamento
      ? `- É lançamento: SIM (pilar de demanda ignorado)`
      : null,
    ``,
  ].filter(Boolean) as string[]

  if (relacionados.length > 0) {
    linhas.push(`OUTROS PRODUTOS DESTE FORNECEDOR (${relacionados.length}):`)
    relacionados.slice(0, 5).forEach((p) => {
      linhas.push(
        `- ${p.nome}: score ${p.scoreTotal.toFixed(1)} (${getDecisionLabel(p.decision)}) — ${getStageLabel(p.stage)}`,
      )
    })
    linhas.push('')
  }

  if (produto.observacoes) {
    linhas.push(`OBSERVAÇÕES:`)
    linhas.push(produto.observacoes)
  }

  return linhas.join('\n')
}

export function gerarContextoOperacao(produtos: RadarProduto[]): string {
  const aprovados = produtos.filter((p) => p.stage === 'aprovado')
  const emDecisao = produtos.filter((p) => p.stage === 'decisao')
  const excelentes = produtos.filter(
    (p) =>
      p.decision === 'excelente' &&
      p.stage !== 'aprovado' &&
      p.stage !== 'arquivado',
  )
  const sinais = gerarSinais(produtos)
  const fornecedores = Array.from(new Set(produtos.map((p) => p.fornecedor)))

  const linhas = [
    `=== CONTEXTO DA OPERAÇÃO DE SOURCING ===`,
    `Data: ${new Date().toLocaleDateString('pt-BR')}`,
    ``,
    `RESUMO:`,
    `- Total de produtos: ${produtos.length}`,
    `- Em prospecção: ${produtos.filter((p) => p.stage === 'prospeccao').length}`,
    `- Aguardando custo: ${produtos.filter((p) => p.stage === 'aguardando_custo').length}`,
    `- Prontos para decisão: ${emDecisao.length}`,
    `- Aprovados: ${aprovados.length} (${aprovados.filter((p) => p.statusCompra === 'a_comprar').length} a comprar, ${aprovados.filter((p) => p.statusCompra === 'comprado').length} comprados)`,
    `- Arquivados: ${produtos.filter((p) => p.stage === 'arquivado').length}`,
    `- Fornecedores distintos: ${fornecedores.length}`,
    ``,
  ]

  if (sinais.length > 0) {
    linhas.push(`ALERTAS ATIVOS (${sinais.length}):`)
    sinais.forEach((s) => {
      linhas.push(
        `- [${s.tipo.toUpperCase()}${s.urgente ? ' - URGENTE' : ''}] ${s.titulo}: ${s.descricao}`,
      )
    })
    linhas.push('')
  }

  if (emDecisao.length > 0) {
    linhas.push(`AGUARDANDO DECISÃO:`)
    emDecisao.forEach((p) => {
      const dias = Math.floor(
        (Date.now() - new Date(p.stageEnteredAt).getTime()) / 86400000,
      )
      linhas.push(
        `- ${p.nome} (${p.fornecedor}) — Score ${p.scoreTotal.toFixed(1)} — há ${dias} dias`,
      )
    })
    linhas.push('')
  }

  if (excelentes.length > 0) {
    linhas.push(`PRODUTOS COM SCORE EXCELENTE:`)
    excelentes.forEach((p) => {
      linhas.push(
        `- ${p.nome} (${p.fornecedor}) — Score ${p.scoreTotal.toFixed(1)} — ${getStageLabel(p.stage)}`,
      )
    })
  }

  return linhas.join('\n')
}
