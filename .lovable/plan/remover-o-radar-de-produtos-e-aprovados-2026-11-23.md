# Remover o Radar de Produtos e Aprovados

## O que some do app
- Menu lateral (desktop e celular) e paleta de comandos: itens "Radar" / "Aprovados".
- Página do Radar inteira: Pipeline (kanban), Aprovados/compras, Solicitar orçamento, cadastros de empresas e fornecedores, histórico, exportar campos, insights.
- Configurações: seção de parâmetros/pilares do Radar.
- Painel inicial: insights e números de produtos.
- Arquivo: aba/itens de produtos arquivados.
- Grafo: nós âmbar de produtos.
- Links: produtos deixam de aparecer no painel de conexões, no seletor de links, na busca e nas sugestões da IA.
- NexusBot: deixa de buscar e falar de produtos.
- Importar: remove a opção de importar produtos (se existir).
- Endereços antigos /radar e /radar/aprovados passam a cair na página inicial.

## O que fica
- Notas, tarefas, projetos, Caixa, grafo, NexusBot, sugestões — tudo continua.
- Os dados de produtos no banco ficam guardados (sem apagar), para poder recuperar se mudar de ideia. Posso apagar definitivamente depois, se pedir.

## Detalhes técnicos
- Apagar: `src/pages/RadarPage.tsx`, `src/components/radar/*`, `src/hooks/radar/*`, `src/lib/radar/*`, `src/types/radar.ts`.
- Editar: `App.tsx` (rotas + redirect), `AppSidebar.tsx`, `MobileSidebarContent.tsx`, `CommandPalette.tsx`, `LinkPanel.tsx`, `LinkPanelDock.tsx`, `LinkPicker.tsx`, `RelatedSuggestions.tsx`, `ImportDialog.tsx`, `NexusBot.tsx`, `useEntitySearch.ts`, `lib/api/embedding.ts`, `Archive.tsx`, `Dashboard.tsx`, `Graph.tsx`, `Settings.tsx`, `Suggestions.tsx`, estilos de radar em `index.css`.
- Edge functions `embed-entity`, `nexus-chat`, `scan-link-suggestions`: remover tipo `produto` e redeployar.
- Remover dependências usadas só pelo Radar (ex.: `jspdf`, `@dnd-kit` se não usados em outro lugar).
- Tabelas `radar_*` permanecem no banco, sem uso.
- Verificar typecheck e abrir o app para confirmar menus e páginas.
