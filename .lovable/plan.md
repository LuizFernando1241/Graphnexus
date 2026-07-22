
## Objetivo
1. Adicionar coluna **Aguardando Decisão** ao Kanban (total: 4 colunas com grid perfeito em qualquer monitor).
2. Reformular a coluna **Decisão** para reter produtos já **aprovados** e **reprovados** (com filtro).
3. Só quando o usuário clicar **"Comprar"** o produto vai para a página **Aprovados** (comprados/a comprar).
4. Adicionar **modo expansivo** ao card com botão global "Expandir todos" e expandir individual.

---

## Mudanças de fluxo

Antes:
```text
Prospecção → Aguardando Custo → Decisão →(Comprar)→ Aprovados
                                        →(Recusar)→ Arquivado
```

Depois:
```text
Prospecção → Aguardando Custo → Aguardando Decisão → Decisão (Aprovado|Reprovado)
                                                            →(Comprar)→ Página Aprovados
                                                            →(Reabrir)→ volta p/ Aguardando Decisão
```

- Novo stage: `aguardando_decisao` (substitui o antigo papel de "decisao" como fila de análise).
- Stage `decisao` passa a ser terminal-no-kanban e agrupa `decision_final = 'aprovado' | 'reprovado'`.
- Novo stage `comprado` para produtos que foram para a página Aprovados (a página passa a filtrar `stage='comprado'`).
- `arquivado` continua para descartes gerais fora do fluxo.

## Banco (1 migration)
- `radar_produtos.decisao_final text` (`'aprovado' | 'reprovado' | null`) — preenchido quando o produto entra no stage `decisao`.
- Backfill: produtos hoje em `stage='aprovado'` → `stage='comprado'`; hoje em `stage='decisao'` → `stage='aguardando_decisao'` (ficam para o usuário decidir).
- Atualizar CHECK/enum se existir.

## UI Kanban (`KanbanBoard.tsx`, `KanbanColumn.tsx`, `RadarPage.tsx`)
- 4 colunas: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3` + colunas mais compactas (`min-w-0`, header truncado).
- Coluna **Decisão** ganha filtro segmentado no header: `Todos | Aprovados | Reprovados`, cores emerald / rose.
- Chips no header do Radar refletem 4 stages.

## Ações por etapa (`ProdutoCard.tsx` `AcoesPorEtapa`)
- `aguardando_custo` → botão "Enviar para decisão" (→ `aguardando_decisao`).
- `aguardando_decisao` → **Aprovar** (verde) / **Reprovar** (vermelho) → move para `decisao` com `decisao_final` setado.
- `decisao` (aprovado) → **Comprar →** (move para `comprado`, aparece em Aprovados) + "Reabrir".
- `decisao` (reprovado) → **Reabrir análise** + "Arquivar".

## Modo Expansivo (novo)
- Estado no `RadarPage`: `expandedIds: Set<string>` + toggle global `expandAll`.
- Botão no header ao lado de "Filtros": **"Expandir todos"** / **"Recolher todos"**.
- Cada card ganha chevron para expandir individual.
- Área expandida do card mostra:
  - Métricas-chave: Margem %, Ticket, Faturamento/mês, Visitas/mês, Vendas/mês, Concorrentes FULL.
  - Top 3 pilares com maior contribuição e top 1 negativo (via `calcularScore`).
  - Sinais/alertas (`useRadarSinais`).
  - Observações (truncadas em 3 linhas).
  - Data de entrada na etapa + link ML.
- Implementação: `motion.div` com height auto; densidade mantém legibilidade.

## Página Aprovados (`AprovadosPage`, `AprovadosTable`, hook)
- Passa a filtrar `stage === 'comprado'` em vez de `'aprovado'`.
- Título e cópia continuam "Produtos Aprovados / a Comprar" (estrutura da tabela intacta).
- Ação "Arquivar" existente permanece.

## Tipos (`src/types/radar.ts`)
- `PipelineStage` += `'aguardando_decisao' | 'comprado'` (mantendo `'aprovado'` deprecado para compat de leitura antiga se houver).
- `DecisaoFinal = 'aprovado' | 'reprovado'` em `RadarProduto.decisaoFinal?`.

## Arquivos tocados
- Migration nova.
- `src/types/radar.ts`
- `src/hooks/radar/useRadarProdutos.ts` (mapper + mutations `aprovarDecisao`, `reprovarDecisao`, `comprar`)
- `src/components/radar/KanbanBoard.tsx` (4 colunas + filtro decisão)
- `src/components/radar/KanbanColumn.tsx` (header com filtro opcional, densidade)
- `src/components/radar/KanbanDnD.tsx` (aceitar novo stage)
- `src/components/radar/ProdutoCard.tsx` (expand + novas ações)
- `src/pages/RadarPage.tsx` (chips 4 stages, botão expandir todos, filtragem)
- `src/pages/AprovadosPage.tsx` + `AprovadosTable.tsx` (stage `comprado`)
- `src/components/radar/RadarFilters.tsx` (opções de stage atualizadas)

## Fora de escopo
- Não altero lógica de scoring, parâmetros, IA/NexusBot, GraphNexus links.
- Não mexo em Arquivo/Archive além de continuar aceitando `arquivado`.
