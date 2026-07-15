
# Pipeline modular por vendedor

Hoje o Radar tem 5 pilares fixos hardcoded (`margem`, `ticket`, `demanda`, `visitas`, `concorrentes`). Vou transformar isso numa configuração 100% dinâmica: cada vendedor define seus próprios pilares, tipos, faixas de pontos, pesos, faixas de decisão e descartes automáticos. O pipeline e a página de Aprovados passam a renderizar campos e colunas com base nessa configuração.

---

## 1. Modelo de dados (uma única fonte de verdade)

Estender `radar_parametros` para armazenar a definição completa do vendedor num único JSON versionado. Nada de tabelas novas — mantém simples.

```text
radar_parametros
├── pilares:  [ { id, key, label, ativo, tipo, peso, faixas|formula, ordem } ]
├── decisaoThresholds:  { cautela, viavel, excelente }
└── autoDescarte:  [ { id, pilarKey, operador, valor, motivo } ]
```

Tipos de pilar suportados (validado por Zod no cliente):

- `numero`  — input numérico, pontuado por faixas `[{min?, max?, pontos, escalaAberta?}]` (mesma lógica de hoje)
- `formula` — expressão simples entre pilares numéricos, ex: `precoVenda * vendasMes`. Também pontuado por faixas. Whitelist de operadores (`+ - * /`) e variáveis (só ids de outros pilares numéricos) — sem `eval` livre.

`RadarProduto.valoresCustom: Record<string, number>` guarda o valor de cada pilar por id, além dos campos fixos que já existem (`nome`, `fornecedor`, `stage`, `decision`, `scoreTotal`, `statusCompra`, etc.). Os cinco campos hoje colunados (`margem`, `custo`, `precoVenda`, `visitasMes`, `vendasMes`, `concorrentesFull`) permanecem colunas para não quebrar histórico — a config default os mapeia como pilares padrão. Pilares novos vivem só em `valoresCustom` (JSONB).

## 2. Engine de score modular

Reescrever `src/lib/radar/radarScore.ts`:

- Recebe `(valores, parametros)`.
- Itera nos pilares `ativo=true`, calcula pontos por faixa (números) ou avalia fórmula → aplica faixa.
- Soma ponderada como hoje (peso relativo, padrão soma 100).
- Avalia `autoDescarte[]` — se qualquer regra bate, decisão vira `descarte` com o `motivo` configurado.
- Aplica `decisaoThresholds` para classificar `excelente/viavel/cautela/descarte`.
- Retorna `{ scoreTotal, decision, contribuicoes: [{pilarId, pontos, peso, valor}], descartes: [motivo] }`.

## 3. Tela de Configurações (Settings → Radar)

Reformulação da aba já existente (`ParametrosRadar.tsx`):

- **Lista de pilares** com drag-to-reorder, toggle ativo/inativo, editar label, peso (slider), tipo (número/fórmula), faixas de pontos editáveis (add/remover linha), e para fórmula um input com autocomplete de outros pilares.
- **Faixas de decisão** (thresholds) — sliders como hoje.
- **Descartes automáticos** — lista dinâmica: pilar + operador (`<`, `≤`, `>`, `≥`, `=`) + valor + motivo. Botão + para adicionar.
- Botão **Salvar** (sem auto-save) + **Restaurar padrão** + **Recalcular todos os produtos** (usa `recalcularTodos` que já existe, adaptado à nova engine).
- Botão **Duplicar como preset** só para futuro — fora de escopo.

## 4. Drawer de produto dinâmico

`ProdutoDrawer.tsx` para de renderizar campos hardcoded. Passa a iterar `parametros.pilares.filter(p => p.ativo)` e renderiza input apropriado:

- Número → input numérico (com parseNum atual, aceita vírgula).
- Fórmula → readonly, calculado ao vivo, com breakdown "R$154,90 × 20 = R$3.098".
- Cada campo mostra abaixo os pontos que aquele valor vale (usando as faixas configuradas), como já faz hoje com o painel de score.

O `ScorePainel` continua exibindo contribuições, agora dirigido pela config.

## 5. Card do Kanban e tabela de Aprovados

- `ProdutoCard` já mostra pilares como dots — passa a ler `parametros.pilares` para saber quantos/quais mostrar. Máximo 5 visíveis para não estourar; excedentes viram "+N".
- `AprovadosTable` — colunas de pilares deixam de ser fixas. Vendedor escolhe em Settings quais aparecem na tabela (checkbox "Exibir em Aprovados" por pilar). Colunas fixas continuam: nome, fornecedor, score, decisão, status compra, quantidade, ações. Export CSV inclui todos os pilares ativos.

## 6. Migração de dados existentes

Migração idempotente:
1. `ALTER TABLE radar_parametros` — a coluna `faixas` (jsonb) vira o container `pilares` no novo formato; adiciona `pilares jsonb` novo se necessário e faz backfill a partir de `weights + faixas` atuais para o schema novo. Mantém `weights`, `faixas`, `decisao_thresholds`, `auto_descarte` legadas por 1 versão (não removidas nesta migração).
2. `ALTER TABLE radar_produtos ADD COLUMN valores_custom jsonb NOT NULL DEFAULT '{}'::jsonb`.
3. Nada é apagado. Produtos existentes continuam funcionando (config default reproduz o comportamento atual).

## 7. Comportamento ao mudar config

Conforme escolhido: **botão manual Recalcular**. Ao salvar, aparece toast "Configuração salva. 47 produtos podem estar desatualizados — Recalcular agora?". Botão também fica permanente em Settings.

Pilar removido/desativado → valor fica preservado em `valoresCustom` (não some), só para de contar no score. Reativar restaura tudo.

---

## Detalhes técnicos

**Arquivos alterados**
- `src/types/radar.ts` — novos tipos `PilarConfig`, `PilarFaixa`, `RegraDescarte`, `RadarProduto.valoresCustom`.
- `src/lib/radar/radarScore.ts` — reescrita da engine.
- `src/lib/radar/radarFormula.ts` (novo) — parser/avaliador seguro (whitelist).
- `src/lib/radar/defaultParametros.ts` (novo) — config default equivalente ao comportamento atual (5 pilares).
- `src/components/radar/ParametrosRadar.tsx` — UI de configuração completa.
- `src/components/radar/ProdutoDrawer.tsx` — form dinâmico.
- `src/components/radar/ProdutoCard.tsx`, `PilarDots.tsx`, `ScorePainel.tsx` — dirigidos pela config.
- `src/components/radar/AprovadosTable.tsx` + `radarCSV.ts` — colunas dinâmicas.
- `src/hooks/radar/useRadarProdutos.ts` — persiste `valores_custom`, `recalcularTodos` usa nova engine.
- Migração SQL: coluna `valores_custom` em `radar_produtos` + backfill de `radar_parametros`.

**Fora de escopo desta parte**
- Múltiplos perfis nomeados (você escolheu único perfil por usuário).
- Tipos dropdown/booleano (você escolheu só número + fórmula).
- Sugestão de config por IA (pode virar Parte 2).

**Compatibilidade**
- Config default = 5 pilares atuais com pesos/faixas/thresholds atuais → nenhum usuário sente diferença até abrir Settings.
- Todo produto já cadastrado mantém `scoreTotal` até você clicar Recalcular.
