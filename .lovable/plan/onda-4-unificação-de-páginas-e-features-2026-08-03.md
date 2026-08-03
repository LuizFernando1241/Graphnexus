# Onda 4 — Unificação de páginas e features

Levantamento do estado atual (13 rotas, 4.364 linhas em `src/pages`). Abaixo, o que dá para mesclar sem mudar regra de negócio.

## 1. Importar vira parte de Notas/Tarefas (remove a rota `/import`)

`Import.tsx` (245 linhas) reimplementa dropzone, parse e lista de pré-visualização, enquanto o `ImportDropzone` já existe e envolve as páginas de Notas e Tarefas. Ação: transformar a tela de importação num diálogo "Importar Markdown" acionado pelo header de Notas/Tarefas e pelo drop de arquivos, reaproveitando o mesmo painel de revisão. A rota `/import` passa a redirecionar para `/notes`.

## 2. Radar + Aprovados numa página com abas

`AprovadosPage.tsx` é só um cabeçalho em volta de `AprovadosTable`, e o usuário fica pulando entre duas rotas com botões "Voltar ao Radar". Ação: `/radar` ganha abas **Pipeline** e **Comprados**; `/radar/aprovados` continua funcionando e abre direto na aba Comprados. Um único `ProdutoSheet` e um único carregamento de produtos para as duas visões.

## 3. Sugestões: uma superfície só

Hoje existem a página `/suggestions` e o dock `RelatedSuggestions` nos detalhes, com renderização própria de cada card. Ação: extrair um `SuggestionCard` compartilhado (aceitar/recusar/abrir) usado pelos dois, e o dock passa a linkar "ver todas" para a página. A página continua existindo — é a caixa de entrada.

## 4. Arquivo: uma consulta, não quatro

`Archive.tsx` roda quatro queries e repete quatro blocos de lista quase idênticos (notas, tarefas, projetos, produtos). Ação: um hook `useArchivedEntities` que devolve os quatro tipos e um componente único de linha arquivada com ações restaurar/excluir. Comportamento igual, ~40% menos código.

## 5. Detalhes de entidade: casca comum

`NoteDetail`, `TaskDetail` e `ProjectDetail` (230/388/395 linhas) já compartilham `useEntityDetail`, mas repetem o layout: breadcrumb, título editável, ações de arquivar/excluir, dock de links e sugestões. Ação: um `EntityDetailLayout` com slots para o conteúdo específico de cada tipo; a lógica de cada página fica intacta.

## 6. Navegação mais curta

Com Importar embutido e Radar unificado, a sidebar cai de 11 para 9 itens e o grupo Radar deixa de ter dois links.

## Detalhes técnicos

- Rotas em `src/App.tsx`: `/import` → redirect; `/radar/aprovados` mantido apontando para a aba.
- Novos: `components/import/ImportDialog.tsx`, `components/suggestions/SuggestionCard.tsx`, `hooks/useArchivedEntities.ts`, `components/EntityDetailLayout.tsx`.
- Tocados: `pages/Import.tsx` (removido), `pages/AprovadosPage.tsx`, `pages/RadarPage.tsx`, `pages/Archive.tsx`, `pages/Suggestions.tsx`, `components/RelatedSuggestions.tsx`, os três `*Detail.tsx`, `AppSidebar.tsx`, `MobileSidebarContent.tsx`.
- Sem migrações de banco. Score, pipeline, IA e permissões não mudam.
- Ao final: typecheck e verificação visual das telas afetadas.

## Ordem sugerida

Posso fazer tudo, ou começar pelos itens 1 e 2 (maior ganho visível) e seguir depois com 3–5.
