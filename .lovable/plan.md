## Problema

Hoje os pesos, limiares de decisão e descartes automáticos já são configuráveis, mas **as faixas de pontuação de cada pilar estão hardcoded** em `src/lib/radar/radarScore.ts` (funções `calcularPilarMargem`, `calcularPilarTicket`, etc.). Ajustar os pesos em Parâmetros não muda o quanto cada faixa pontua — só muda o peso relativo. Você quer poder editar as próprias faixas (ex.: "≥ 20% = 10 pts", "≥ 15% = 8 pts" etc.) e ver isso refletir imediatamente no score, na decisão e no kanban.

O campo `faixas` já existe em `RadarParametros` e na tabela `radar_parametros`, mas está vazio e não é lido pelo cálculo.

## Solução (modular, sem migration nova)

### 1. `src/lib/radar/radarScore.ts` — engine genérica baseada em faixas

- Definir `DEFAULT_FAIXAS: RadarFaixas` com as 5 faixas de cada pilar, exatamente como descrito (margem, ticket, demanda, visitas, concorrentes).
- Cada item de faixa: `{ limiteMin, pontos, label, escalaAberta?: boolean, descarte?: boolean, divisor?: number }`. O flag `escalaAberta` ativa a fórmula `pontos = base × (valor / limiteMin)` para a faixa máxima. O flag `descarte` marca faixas que disparam descarte automático (Ticket < 30, Demanda < 100 exceto lançamentos).
- Substituir os 5 `calcularPilarX` por uma única função `avaliarFaixa(valor, faixas)` que percorre as faixas ordenadas e retorna `{ pontos, descarte }`.
- Em `calcularScore`, ler `params.faixas` com merge sobre `DEFAULT_FAIXAS` (qualquer pilar ausente cai no padrão), e passar para `avaliarFaixa`.
- Manter os descartes automáticos por preço/faturamento atuais (já são parametrizados via `autoDescarte`), mas também aceitar o flag `descarte` vindo das faixas (mais flexível no futuro).
- Adicionar `DEFAULT_PARAMETROS.faixas = DEFAULT_FAIXAS` para que projetos novos já saiam corretos.

### 2. `src/components/radar/ParametrosRadar.tsx` — UI das faixas

Adicionar um 4º `AccordionItem` chamado **"Faixas de Pontuação por Pilar"**, contendo um sub-accordion (um item por pilar). Cada pilar mostra uma tabela editável com 5 linhas:

| Faixa máxima (≥) | Pontos | (badge "escala aberta" quando aplicável) |

- Campos `Input type="number"` para `limiteMin` e `pontos`.
- Botão "Restaurar faixas padrão deste pilar".
- Para Concorrentes (não tem escala aberta nem unidades monetárias), renderizar variante simplificada.
- Helpers de unidade: `%` para margem, `R$` para ticket/demanda, `visitas` para visitas, `un.` para concorrentes.
- Validação leve: avisar (sem bloquear) se as faixas não estiverem em ordem decrescente de `limiteMin`.

O botão "Restaurar padrões" geral já existente passa a restaurar também `faixas` para `DEFAULT_FAIXAS`.

### 3. Propagação

Nada mais precisa mudar:
- `useRadarProdutos` já chama `calcularScore(form, parametros)` ao criar/atualizar produtos.
- `ScorePainel` (drawer) já recalcula em tempo real via `useMemo` com `parametros`.
- O kanban e badges leem `produto.scoreTotal` / `produto.decision` já recalculados.

Único cuidado: após salvar novos parâmetros, scores de produtos já salvos no banco continuam com o valor antigo até a próxima edição. Adicionar um botão discreto **"Recalcular todos os produtos"** ao lado de "Salvar" que itera os produtos do usuário, recalcula score/decision com os novos parâmetros e atualiza no Supabase (operação em lote via `Promise.all`, com toast de progresso).

## Arquivos tocados

- `src/lib/radar/radarScore.ts` — refatorar para engine baseada em faixas + `DEFAULT_FAIXAS`.
- `src/components/radar/ParametrosRadar.tsx` — adicionar seção de faixas + botão recalcular.
- `src/hooks/radar/useRadarProdutos.ts` — expor uma função `recalcularTodos()` que reaproveita `calcularScore`.
- `src/types/radar.ts` — ajuste pequeno em `FaixaItem` se necessário (adicionar `escalaAberta`, `descarte`, `divisor`).

Nenhuma migration nova: o campo `faixas jsonb` já existe na tabela `radar_parametros`.

## Verificação

1. Mudar "Margem ≥ 20% = 10 pts" para "≥ 25% = 12 pts" → produto com 22% de margem que antes dava 10 pts passa a dar pontos pela faixa inferior; score recalcula no drawer ao vivo.
2. Mudar threshold de "Excelente" para 50 → produto com score 42 muda de 🚀 para ✅ no kanban após recalcular.
3. Clicar "Restaurar padrões" volta tudo (pesos, limiares, descartes, faixas) ao default.
4. "Recalcular todos os produtos" atualiza scores no banco e o kanban reflete sem reload.