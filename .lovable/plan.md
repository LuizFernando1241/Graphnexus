## Problema

Hoje no celular a aba **Tarefas** mostra um Kanban horizontal (Backlog / A Fazer / Em Progresso / Concluído) que rola lateralmente coluna por coluna. O usuário precisa:

1. Rolar **horizontalmente** entre 4 colunas para descobrir onde uma tarefa está.
2. Rolar **verticalmente** dentro de cada coluna para ver as tarefas.
3. Não consegue ver o "todo de hoje" sem trocar de coluna.

Isso é exatamente o que apps como **Todoist, Things 3, TickTick, Microsoft To Do, Linear Mobile e Notion Tasks** evitam: no celular eles abandonam o Kanban e mostram **uma única lista vertical agrupada/segmentada**, com filtros rápidos no topo.

## Padrão de mercado (referência)

| App | Mobile |
|---|---|
| Todoist | Lista única + tabs "Hoje / Próximas / Inbox" |
| Things 3 | Lista única agrupada por seção colapsável |
| TickTick | Lista vertical + segmented control no topo |
| Linear | Inbox vertical + filtro por status |
| Notion | Lista vertical agrupada |

Comum a todos: **Kanban só no desktop. No mobile, lista vertical com agrupamento + filtros segmentados.**

## Solução

Manter o Kanban atual em `md:` para cima (desktop/tablet) e, **no mobile**, trocar por uma visualização lista-vertical otimizada.

### Mobile (`< md`): nova visualização "Lista"

```text
┌─────────────────────────┐
│ Tarefas         [+ Nova]│
├─────────────────────────┤
│ [Hoje] Próximas Todas   │ ← segmented control sticky
│ 🔍 Buscar...            │
├─────────────────────────┤
│ ▾ Em Progresso (2)      │ ← seção colapsável
│   • Estudar React       │
│   • Refatorar API       │
│ ▾ A Fazer (5)           │
│   • ...                 │
│ ▸ Backlog (12)          │ ← recolhida por padrão
│ ▸ Concluído (3)         │ ← recolhida por padrão
└─────────────────────────┘
```

**Componentes:**

1. **Segmented control sticky no topo** com 3 filtros rápidos:
   - **Hoje** (default): tarefas com `due_date <= hoje` ou `status = in_progress`, exceto `done/cancelled`
   - **Próximas**: `due_date` nos próximos 7 dias
   - **Todas**: tudo (exceto `done` antigo e `cancelled`)

2. **Lista única vertical** agrupada por status (`Em Progresso → A Fazer → Backlog → Concluído`).
   - Cada grupo é um header colapsável com contagem.
   - **Em Progresso** e **A Fazer** abertos por padrão; **Backlog** e **Concluído** fechados.
   - Estado de colapso persistido em `localStorage` (`ui:tasks-mobile-groups`).

3. **Card compacto por tarefa** (uma linha):
   - Bolinha de status colorida + título + (prioridade, data, recorrência) abaixo.
   - **Tap** → abre o detalhe.
   - **Long-press / swipe** já vai existir via `SwipeableItem` (já no projeto): swipe direito = concluir, swipe esquerdo = mover.
   - Botão de mover (`ArrowLeftRight`) no canto direito como fallback (já existe).

4. **FAB (Floating Action Button)** "+ Nova Tarefa" no canto inferior direito, fixo (padrão Todoist/TickTick) — substituindo o botão do header no mobile, que fica longe do polegar.

5. **Busca/filtro** colapsado por padrão; ícone de lupa expande o input.

### Desktop (`md:` em diante)

- Mantém o Kanban atual sem mudança.

## Arquivos a alterar/criar

1. **`src/components/tasks/TasksMobileList.tsx`** (novo) — toda a UI mobile descrita acima. Recebe `tasks`, `onTaskClick`, `onMove`, `onComplete` como props para reutilizar a lógica de mutações de `Tasks.tsx`.

2. **`src/components/tasks/TasksMobileFAB.tsx`** (novo, ou inline) — botão flutuante "+ Nova Tarefa".

3. **`src/pages/Tasks.tsx`**:
   - Detectar viewport com `useIsMobile()` (já existe em `src/hooks/use-mobile.tsx`).
   - Renderizar `<TasksMobileList />` se mobile, ou o Kanban atual se desktop.
   - Esconder o botão "Nova Tarefa" do header no mobile (FAB substitui).

4. **`src/hooks/useLocalStorage.ts`** — já existe, será usado para persistir o estado de colapso dos grupos.

5. **`src/components/ui/SwipeableItem.tsx`** — já existe, será reusado para swipe-to-complete e swipe-to-move.

## Detalhes técnicos

- **Filtros "Hoje/Próximas/Todas"**: filtragem client-side sobre `tasks` já vindas do `useQuery`. Sem nova chamada de rede.
- **Acessibilidade**: cada header de grupo é `<button aria-expanded>`; FAB tem `aria-label="Nova tarefa"`; alvos de toque ≥ 44×44px.
- **Performance**: lista renderizada diretamente (volume típico de tarefas pessoais é baixo, < 200). Se crescer, podemos adicionar `react-window` depois.
- **Persistência de colapso**: `useLocalStorage<{[status]: boolean}>("ui:tasks-mobile-groups", { backlog:false, todo:true, in_progress:true, done:false })`.
- **DnD**: removido no mobile (não é usado pelos apps de referência); movimentação via swipe + drawer existente.

## Resultado esperado

- O usuário abre Tarefas no celular e vê **imediatamente** o que precisa fazer hoje, sem rolar lateralmente.
- Para ver outra "coluna", ele só expande o grupo — sem trocar de tela.
- Botão de criar tarefa fica acessível ao polegar (FAB).
- Desktop continua exatamente como está.
