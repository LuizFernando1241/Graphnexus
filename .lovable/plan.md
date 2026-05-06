## 1. Horário nas tarefas

Adicionar um campo de **hora** ao lado do campo "Data de entrega" (e refletir no card/listagem).

### Banco
Nova migração: adiciona coluna `due_time TEXT` (formato `"HH:mm"`, nullable) à tabela `tasks`. Texto evita problemas de timezone (a data já é `date` simples). Não afeta dados existentes.

```sql
ALTER TABLE public.tasks ADD COLUMN due_time TEXT;
```

### Tipos & API
- `src/types/entities.ts`: adicionar `due_time: string | null` em `Task`.
- `src/lib/api/tasks.ts`: incluir `due_time` em `rowToTask`, `createTask`, `updateTask` (mesmo padrão de `due_date`).

### UI — Edição (`src/pages/TaskDetail.tsx` + `useTaskDetail.ts`)
- Adicionar estado `dueTime` (string `"HH:mm"` ou `""`) no hook, com setter, sincronização com `task.due_time` e envio no `saveMutation`.
- No bloco "Data de entrega" trocar a coluna única por um grid de 2 colunas: **Data** (popover atual) | **Horário** (`<Input type="time">`).
- O campo de horário fica desabilitado se não houver data; ao limpar a data, limpa-se também a hora.

### UI — Listagem
- `src/pages/Tasks.tsx` (TaskCard) e `src/components/tasks/TasksMobileList.tsx` (TaskRow): se `due_time` existir, exibir `dd/MM HH:mm`; caso contrário, só `dd/MM`.

### Filtro "Hoje" no mobile
Sem mudança funcional — continua por data. (Hora é apenas informativa por enquanto.)

---

## 2. Sidebar com modo "apenas ícones"

Hoje a sidebar tem `SIDEBAR_MIN = 180px`, o que impede colapsar para mostrar só ícones. A solução é permitir reduzir até ~64px e, abaixo de um limiar, alternar automaticamente para o modo compacto.

### Alterações em `src/components/AppSidebar.tsx`
- `SIDEBAR_MIN = 64` (largura de um item só com ícone, padding incluído).
- Calcular `const collapsed = width < 140;`
- Quando `collapsed`:
  - Esconder o texto do logo (`<span>NexusGraph</span>`) — fica só o quadrado do ícone.
  - Esconder o `<span>{item.title}</span>` em cada NavLink; centralizar o ícone (`justify-center`, `px-2`).
  - Adicionar `title={item.title}` (tooltip nativo) e `aria-label` em cada NavLink para acessibilidade.
  - No rodapé, esconder o e-mail e mostrar só o botão de logout, centralizado.
- Adicionar **snap** no `ResizeHandle`: quando o usuário soltar entre 100–140px, ajustar para 80px (modo ícone); entre 140–180px, ajustar para 200px (modo expandido). Implementação: handler `onCommit` opcional no `ResizeHandle` chamado no `mouseup`.

### Alterações em `src/components/ui/ResizeHandle.tsx`
- Adicionar prop opcional `onCommit?: (value: number) => void` chamada no `mouseup` final, permitindo ao consumidor fazer o snap.

### Resultado
O usuário pode arrastar a sidebar até ~64px e ela vira uma barra de ícones (estilo VSCode/Notion). Largura preferida é persistida em `localStorage` como hoje.

---

## Arquivos a alterar/criar

- **Novo**: `supabase/migrations/<timestamp>_add_tasks_due_time.sql`
- `src/types/entities.ts`
- `src/lib/api/tasks.ts`
- `src/hooks/useTaskDetail.ts`
- `src/pages/TaskDetail.tsx`
- `src/pages/Tasks.tsx` (TaskCard)
- `src/components/tasks/TasksMobileList.tsx` (TaskRow)
- `src/components/AppSidebar.tsx`
- `src/components/ui/ResizeHandle.tsx`
