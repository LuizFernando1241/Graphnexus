## Problemas identificados

1. **FABs sobrepostos** (`QuickAdd` + `NexusBot`): ambos `fixed` no canto inferior direito (bottom-5/6, right-5/6, ambos 56px). Em qualquer tela o "+" cobre o botão da IA.
2. **Pipeline com coluna vazia** (`KanbanBoard`): grid declarada como `xl:grid-cols-4` mas só existem 3 estágios (Prospecção, Aguardando Custo, Decisão). Em telas ≥1280px sobra um slot vazio à direita. O skeleton de loading tem o mesmo bug.
3. **Densidade baixa para alto volume**: usuário processa dezenas de produtos/dia. Hoje cada coluna mostra poucos cards porque a página rola junto com a coluna; não há altura própria nem rolagem interna eficaz, e o card tem padding generoso.
4. **Contador do header** (RadarPage) só destaca "decisão" como badge urgente, mas o usuário também precisa ver Prospecção e Aguardando Custo com a mesma proeminência visual quando o volume é alto.
5. **AprovadosPage**: header simples sem contadores/atalhos; tela inteira é uma tabela única sem ações em massa visíveis (verificar rapidamente no fix).

## Mudanças

### Fix 1 — FAB stack (sem sobreposição)
Em `src/components/AppLayout.tsx`, criar um único contêiner `fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3` que empilha NexusBot **acima** do QuickAdd. Remover o posicionamento `fixed` interno de `QuickAdd` e `NexusBot` (passar a serem `relative` dentro do stack), mantendo botões 56×56. Resultado: IA fica em cima, "+" embaixo, ambos clicáveis, mesma coluna.

### Fix 2 — Kanban com 3 colunas reais
Em `src/components/radar/KanbanBoard.tsx` e no skeleton de `RadarPage.tsx`, trocar:
- `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`.
Cada coluna passa a ocupar ~1/3 da largura no desktop; sem espaço fantasma.

### Fix 3 — Densidade para dezenas de produtos/dia
- `KanbanColumn`: dar altura própria com rolagem interna — `h-[calc(100vh-220px)]` no desktop, mantendo `min-h-[300px]` no mobile, e a área de cards `overflow-y-auto` (já existe) passa a rolar de fato.
- `ProdutoCard`: reduzir padding (`p-3` → `p-2.5`), apertar gaps internos, opção compacta com fonte do título `text-sm` e linha única (truncate) — sem remover informação crítica (score, fornecedor, preço).
- Header da coluna sticky no topo da rolagem (`sticky top-0 bg-card/80 backdrop-blur`).

### Fix 4 — Header do Radar mais informativo
Substituir a linha "Prospecção (X) · Aguardando (Y) · Decisão (Z)" por 3 chips coloridos clicáveis (azul/âmbar/violeta combinando com a coluna) que funcionam como atalho/filtro rápido por estágio. O badge "aguardando decisão" continua no título.

### Fix 5 — AprovadosPage (toque rápido)
Adicionar contador no header ("X produtos aprovados") e atalho para voltar ao Radar. Sem mudar a tabela em si nesta passagem.

## Fora de escopo
- Não mexer em lógica de Kanban DnD, mutations, ou regras de negócio.
- Não redesenhar `ProdutoDrawer`, `HistoricoModal`, ou tabelas internas.
- Sem mudanças no backend.

## Arquivos
- `src/components/AppLayout.tsx` — montar stack único de FABs
- `src/components/QuickAdd.tsx` — remover `fixed`, virar item do stack
- `src/components/NexusBot/NexusBot.tsx` — remover `fixed` do botão flutuante
- `src/components/radar/KanbanBoard.tsx` — grid 3 colunas
- `src/components/radar/KanbanColumn.tsx` — altura/scroll/header sticky
- `src/components/radar/ProdutoCard.tsx` — densidade compacta
- `src/pages/RadarPage.tsx` — skeleton 3 colunas + chips de stage
- `src/pages/AprovadosPage.tsx` — contador no header

## Critério de aceite
- IA e "+" totalmente visíveis e clicáveis em desktop e mobile.
- Pipeline ocupa 100% da largura no desktop, sem coluna vazia.
- Colunas rolam internamente; é possível ver 8+ cards por coluna sem rolar a página.
- Chips de estágio no header do Radar filtram por clique.
