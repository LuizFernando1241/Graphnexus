# Auditoria do NexusGraph

Relatório apenas — nenhum código foi alterado. Classificações: MANTER / MESCLAR / MELHORAR / CORTAR.

## 1. Inventário de features por área

### Shell global (`AppLayout`, `App.tsx`)
- Sidebar desktop + Sheet mobile; rotas protegidas por `ProtectedRoute`.
- Cache TanStack Query persistido em IndexedDB (7 dias) + `OfflineBanner`.
- `CommandPalette` (⌘K), `Caixa` (captura IA, atalhos shift+N / shift+space), `NexusBot` (chat IA flutuante).
- Hooks globais: `useTaskDueNotifications`, `useAutoTriage`.

### Dashboard `/`
Contadores (notas/tarefas/projetos), atrasadas/próximas, feed de atividade, swipe concluir/adiar, `WeeklyReview` (revisão guiada em 4 passos), `PainelInsights` (sinais do Radar).

### Notas `/notes`, `/notes/:id`
Lista com busca server-side debounced, filtro por tag, arquivadas, swipe fixar/arquivar. Detalhe: editor rich text, Ctrl+S, export markdown, fixar/arquivar/excluir, bloqueio de navegação com alterações não salvas, `LinkPanelDock`.

### Tarefas `/tasks`, `/tasks/:id`
Views lista/board, toolbar de filtros/ordenação/densidade, `QuickAddTaskRow`, `MoveTaskDrawer`, recorrência (`RecurrenceSelector`, completar/pular), "Transformar em Nota", `LinkPanelDock`.

### Projetos `/projects`, `/projects/:id`
Árvore hierárquica com progresso recursivo, criar subprojeto, reparent com verificação de ciclo, `ProjectHero`, `ProjectNarrative`, `ProjectAIPanel`, abas Tarefas/Notas, `LinkPanelDock`.

### Grafo `/graph`
Force-graph 3D de notas/tarefas/projetos/produtos + `entity_links`, busca, filtro por tipo, toggle órfãos, clique navega.

### Arquivo `/archive`
Abas Notas/Projetos/Tarefas/Produtos, restaurar e excluir definitivo.

### Importar `/import` + `ImportDropzone`
Drag & drop de `.md`/`.zip`, detecção de tipo por linha, importação em lote.

### Radar `/radar`, `/radar/aprovados`
Kanban 4 colunas com DnD, cards expansíveis, filtros básicos + avançados, `ProdutoDrawer` (abas Produto/Mercado/Notas, score em tempo real), `HistoricoModal`, `PainelConexoes`, `OrcamentoDialog` (PDF), tabela de aprovados com edição inline e export CSV.

### Sugestões IA `/suggestions` + `RelatedSuggestions`
Inbox de links sugeridos por embeddings, rescan sob demanda, aceitar/descartar.

### Configurações `/settings`
Aba Radar (`ParametrosRadar`: pesos, faixas, pilares customizados, descartes) e aba IA (reindexar tudo).

---

## 2. Duplicações

| Item | Evidência | Ação |
|---|---|---|
| 4 fluxos de criação (`Caixa.tsx`, `QuickAdd.tsx`, `QuickAddTaskRow.tsx`, `ProjectTasksTab.tsx:38`) reimplementam `createTask/createNote/createProject` + `parseTaskInput` | cada um com mutação/parse próprios | **MESCLAR** num hook `useQuickCreate`; `QuickAdd.tsx` já é morto → CORTAR |
| 4 buscas independentes: `CommandPalette` (6 `ilike`), `Notes` (server debounced), `Tasks` (filtro client-side), `RadarFilters` | sem abstração comum | **MESCLAR** em `useEntitySearch` com estratégia única |
| 2 sistemas de links sobre a mesma tabela `entity_links`: `lib/api/links.ts` + `useLinks.ts` (Task/Note/Project) vs `useRadarEntityLinks.ts` (produtos) | ambos duplicam o merge de query source/target | **MESCLAR** — Radar deve consumir `fetchEntityLinks` |
| 2 UIs de links: `LinkPanel`+`LinkPicker` vs `PainelConexoes` | mesma função, zero código compartilhado | **MESCLAR** |
| 3 hooks de detalhe quase idênticos (`useTaskDetail` 280l, `useNoteDetail` 218l, `useProjectDetail` 269l) + `useEntityDetail` genérico morto | refactor abandonado | **MESCLAR** finalizando `useEntityDetail<T>` |
| Cor por status/progresso duplicada em `Projects.tsx:25-37`, `ProjectHero.tsx:15-17`, `ProjectNarrative.tsx:21-24` (com valores divergentes) | mesmo conceito, tons diferentes | **MESCLAR** num helper + tokens |
| Paleta de decisão do Radar repetida 4x: `ScoreBar.tsx:12`, `KanbanBoard.tsx:30-51`, `PilarDots.tsx:18`, `ProdutoCard.tsx:71` | | **MESCLAR** num mapa único |

---

## 3. Código morto — todos **CORTAR**

- `src/components/QuickAdd.tsx` (154 linhas) — substituído pela `Caixa`, nunca importado.
- `src/hooks/useEntityDetail.ts` (276 linhas) — nunca importado (ou finalizar o refactor: MESCLAR).
- `src/components/projects/ProjectMetrics.tsx`
- `src/components/radar/RadarChip.tsx`
- `src/hooks/radar/useRadarFeedAtividade.ts`
- `src/lib/radar/getProductContext.ts`
- `src/pages/Index.tsx` — placeholder do template, fora das rotas.
- Namespace `nexus.*` em `tailwind.config.ts:72-78` — sem uso.
- 12 primitivos shadcn não usados: `aspect-ratio`, `avatar`, `carousel`, `chart`, `context-menu`, `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `pagination`, `radio-group`, `toggle-group`.
- Docs de análise obsoletos na raiz (`CODE_REVIEW.md`, `HOOKS_REFACTORING_GUIDE.md`, `PERFORMANCE_QUALITY_ANALYSIS.md`, `RUNTIME_ERRORS_ANALYSIS.md`) — **MELHORAR**: consolidar ou remover.

---

## 4. Inconsistências visuais

- **Dois sistemas de toast ativos ao mesmo tempo** (`App.tsx:8-9,95-96`: Radix `Toaster` + `Sonner`) — **MESCLAR** (escolher Sonner).
- **Cores hardcoded fora do design system** (existe `success`/`warning`/`destructive` em `index.css:8-59`, mas o código usa `emerald/amber/violet/red/blue` cru): concentração em `RadarPage.tsx:131-167`, `ParametrosRadar.tsx`, `PainelInsights.tsx:30-56`, `AprovadosTable.tsx:165`, `ProdutoCard.tsx:71-79` (`bg-emerald-600 text-white`), `TaskRow.tsx:14-17`, `Projects.tsx:25-37`, `Graph.tsx:154-559` (`bg-black/40`, `bg-[#09090b]`, `text-white`) — **MELHORAR**: migrar para tokens e criar tokens de escala (score/prioridade).
- **Overlays inconsistentes**: `Drawer` (Vaul) só em `MoveTaskDrawer`; `Sheet` no resto; `ProdutoDrawer` chama-se drawer mas é `Sheet` — **MELHORAR**/padronizar. `AlertDialog` para exclusão está consistente → **MANTER**.
- **Headers de página**: 3 variações de `h1` (`text-2xl font-bold` na maioria; `Archive.tsx:251` com `font-heading … mb-6`; auth com outra ordem) — **MELHORAR** com componente `PageHeader`.
- **Loading**: Skeleton é o padrão em ~13 telas, mas `Suggestions` e `Settings` usam spinner — **MELHORAR**.
- **Cards**: `Suggestions.tsx:77-80` reimplementa card com `<button>` cru; paddings variam `p-4`/`p-6`/`px-4 py-3` sem regra — **MELHORAR**.
- **Diálogos de criação locais** duplicados em Notes/Projects/Tasks em vez de um componente compartilhado — **MESCLAR**.

---

## 5. Fluxos de usuário confusos

1. **Criar tarefa: 4 caminhos** (Caixa flutuante, QuickAddTaskRow, aba de projeto, Command Palette indireto) com comportamentos diferentes de parsing IA — **MESCLAR**, manter 2 pontos claros: Caixa (global) e linha inline na lista.
2. **Buscar: 3 caminhos** com resultados diferentes (⌘K global, busca da página, NexusBot semântico) — **MELHORAR**: unificar ⌘K com busca semântica.
3. **Sugestões de link em 2 lugares** (`/suggestions` e `RelatedSuggestions` no dock) — **MANTER** ambos, mas **MELHORAR** deixando claro que são a mesma fila.
4. **Pilares/parâmetros do Radar escondidos** em Configurações → aba Radar (usuário já se perdeu antes) — **MELHORAR**: atalho "Parâmetros" no header do `/radar`.
5. **Arquivamento em dois lugares** (ação na entidade e página `/archive`) — **MANTER**, é padrão esperado.
6. **`OrcamentoDialog` e export CSV** só existem em telas específicas do Radar sem indicação cruzada — **MELHORAR**.
7. **Importar** existe como página `/import` e como dropzone invisível nas listas — **MELHORAR**: dica visual do drop.

---

## 6. Ordem sugerida caso queira executar

1. CORTAR código morto (baixo risco, ganho imediato).
2. MESCLAR toasts + tokens de cor (consistência visual visível).
3. MESCLAR sistema de links (Radar → `entity_links` compartilhado).
4. MESCLAR hooks de detalhe via `useEntityDetail<T>`.
5. MESCLAR criação/busca em hooks únicos.
6. MELHORAR headers, cards, loading e descoberta de features.

Aprove se quiser que eu execute alguma dessas etapas (posso começar pela 1 e 2).
