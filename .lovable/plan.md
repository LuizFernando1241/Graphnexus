## Repaginar UX/UI da aba Tarefas

Hoje a aba Tarefas é um Kanban "puro" no desktop e uma lista agrupada por status no mobile. Falta o que apps de referência (Todoist, Things 3, TickTick, Linear, Motion) entregam: visões inteligentes baseadas em tempo, captura ultrarrápida, atalhos, ações em massa, foco e densidade ajustável.

O plano abaixo cobre **só Tarefas (lista, board, criação rápida e ações)**. Não mexe em backend, schema, autenticação nem outras abas.

---

### 1. Nova arquitetura de visualizações ("Smart Views")

Substituir o board único por um **switcher de visões** no topo, com persistência em localStorage da última visão usada (padrão Todoist/Things):

- **Hoje** — em progresso + vencidas + due hoje. Subgrupos: *Atrasadas*, *Hoje*. Mostra contador grande.
- **Próximos 7 dias** — agrupado por dia (hoje, amanhã, dias da semana, "mais tarde").
- **Inbox / Backlog** — sem due_date e status backlog (captura rápida).
- **Board (Kanban)** — visão atual, mantida.
- **Calendário (mês)** — heatmap de tarefas por dia, click abre o dia.
- **Concluídas** — últimos 30 dias, ordenado por data de conclusão.

Switcher: segmented control no desktop, dropdown compacto no mobile. Cada visão tem URL própria (`/tasks?view=today`) para deep-link.

### 2. Header funcional (toolbar)

Linha única acima da visão com:

- Título "Tarefas" + contador da visão atual.
- Switcher de visões.
- **Busca inline** (Cmd/Ctrl+K abre busca já filtrada por tarefas).
- **Filtros rápidos**: prioridade, projeto, recorrente, com tag, data. Chips removíveis abaixo da toolbar quando ativos.
- **Ordenação**: manual / data / prioridade / criação / título.
- **Densidade**: confortável (atual) / compacta (linhas finas estilo Linear).
- Botão **+ Nova tarefa** (abre QuickAdd com parser — já existe `parseTaskInput.ts`).

No mobile, toolbar vira um header sticky com: título + contador, ícone de busca, ícone de filtros (abre Drawer), FAB de criar.

### 3. Captura rápida ("Quick Add" inline)

Padrão Todoist/Things: linha sempre visível no topo de cada visão com input "Adicionar tarefa…". Ao focar, expande mostrando chips para data, prioridade, projeto, recorrência. `Enter` salva, `Esc` cancela. Reaproveita `parseTaskInput` (ex: "Comprar leite amanhã 18h !p1 #compras").

Atalho global `Q` / `A` foca o quick-add da visão atual.

### 4. Lista enriquecida (linha de tarefa)

Cada item ganha layout consistente entre desktop/mobile:

```text
[ ✓ ]  Título da tarefa                                   [⋯]
       🚩 Alta · 📅 Hoje 14:30 · 🔁 · 📁 Projeto · #tag
```

- **Checkbox grande à esquerda** (área de toque ≥ 44px) para concluir direto sem abrir.
- Animação de fade+strike-through ao concluir; undo toast por 5s (padrão Things/Gmail).
- Cores de prioridade na borda esquerda da linha (P1 vermelho, P2 laranja, P3 azul, sem cor para none).
- Due date colorida: **vermelho se atrasada**, **âmbar se hoje**, neutro se futura. Mostra hora se `due_time` setado.
- Hover (desktop) revela ações: editar, schedule, mover, deletar.
- **Subtarefas / contagem** quando existir (futuro-friendly, fica oculto se 0).

### 5. Agrupamento e ordenação inteligentes

- Cabeçalhos sticky por grupo com contagem e collapse persistido.
- Em "Hoje": grupo *Atrasadas* sempre primeiro, em destaque sutil.
- Em "Próximos 7": cabeçalho com nome do dia + data ("Segunda · 12 mai").
- **Drag-and-drop entre grupos** para reagendar (hoje → amanhã = update due_date), além do board.

### 6. Ações em massa (bulk)

Selecionar com checkbox + shift-click range. Barra inferior aparece com: concluir, mover, mudar prioridade, agendar, deletar. Mobile: long-press inicia modo seleção.

### 7. Atalhos de teclado (estilo Linear/Todoist)

- `Q` ou `A` → nova tarefa
- `J/K` → navegar
- `X` → selecionar
- `E` → concluir
- `T` → schedule hoje, `M` → amanhã, `W` → próxima semana
- `1–4` → prioridade
- `Enter` → abrir, `Esc` → fechar
- `?` → cheat-sheet em modal

Mostrar dica inline na primeira visita.

### 8. Mobile-first refinements

- **Swipe à direita = concluir** (verde com animação), **swipe à esquerda = agendar/deletar** (menu). Reaproveitar `SwipeableItem`.
- **Pull-to-refresh** no topo da lista.
- **Haptic feedback** em concluir/swipe (já existe `vibrate.ts`).
- Bottom sheet para edição rápida ao tocar no due_date / prioridade sem abrir TaskDetail.
- FAB com long-press → menu de templates/criação por voz (futuro hook).

### 9. Estado vazio e onboarding

- Empty states ilustrados por visão ("Tudo limpo para hoje 🎉" em Hoje; "Inbox zerada" em Inbox).
- Banner de tip rotativo no rodapé das visões para apresentar atalhos.

### 10. Polimento visual

- Cards com mais respiro vertical, tipografia hierárquica (título 14/medium, meta 12/muted).
- Animações: framer-motion para entrada de itens (stagger leve), conclusão (collapse height), troca de visão (fade-slide curto).
- Tokens: usar `--destructive` (atrasado), `--warning`/accent âmbar (hoje), `--primary` (recorrente). Sem cores hardcoded; mover paleta de prioridade para `index.css` como `--priority-*`.
- Modo compacto: `min-h-[36px]`, ícones 12px, sem meta wrap.

### 11. Performance e robustez

- Virtualização da lista quando `tasks.length > 100` (tanstack/react-virtual).
- `useMemo` para grupos/ordenação.
- Optimistic updates já existem; estender para drag entre dias.
- Manter offline-friendly (já há `OfflineBanner`).

---

### Detalhes técnicos (para devs)

Arquivos novos sugeridos:

```text
src/pages/Tasks.tsx                    # vira casca + roteamento de view
src/components/tasks/
  TasksToolbar.tsx                     # header, switcher, filtros, busca
  TasksFiltersDrawer.tsx               # filtros mobile
  QuickAddTaskRow.tsx                  # input inline com parser
  TaskRow.tsx                          # linha unificada (desktop+mobile)
  TaskBulkBar.tsx                      # barra de ações em massa
  views/
    TodayView.tsx
    UpcomingView.tsx
    InboxView.tsx
    BoardView.tsx                      # extrai Kanban atual
    CalendarView.tsx
    CompletedView.tsx
  hooks/
    useTasksFilters.ts                 # filtros + ordenação + persistência
    useTaskKeyboardShortcuts.ts
    useTaskSelection.ts                # bulk select
```

Reaproveitar:
- `TasksMobileList` → absorvido por `TodayView`/`UpcomingView` (mesmo componente em ambos viewports, responsivo).
- `MoveTaskDrawer` → mantido para schedule/move rápido.
- `parseTaskInput`, `useRecurrence`, `vibrate`, `SwipeableItem`, `useLocalStorage`.

State da view, filtros, densidade e ordenação em URL search params + localStorage como fallback.

### Entrega faseada sugerida

1. **Fase 1 (base)**: toolbar com switcher Today/Upcoming/Inbox/Board, TaskRow unificada, QuickAdd inline, atalhos básicos (Q, E, T, M).
2. **Fase 2 (poder)**: filtros, ordenação, densidade, bulk actions, swipe mobile completo.
3. **Fase 3 (extras)**: Calendar view, Completed view, virtualização, drag entre dias, cheat-sheet de atalhos.

Cada fase é entregável independente e testável.
