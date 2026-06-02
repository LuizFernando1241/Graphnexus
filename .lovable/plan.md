## Quick Add inteligente — parser local avançado + IA sob demanda

### Resumo
Reforçar `parseTaskInput` com mais campos e melhor detecção; manter input simples; adicionar botão sparkle ✨ para reinterpretar com Lovable AI quando a frase for complexa.

### 1. Parser local (`src/lib/parseTaskInput.ts`)
Reescrever de forma modular. Ordem: status explícito → prioridade → recorrência → projeto → tags → hora → data → título restante.

**Prioridade — vocabulário ampliado**
- urgent: `urgente`, `urgentíssimo`, `pra ontem`, `crítico`, `emergência`, `asap`, `!!`, `!p1`, `p1`, `!urgent`
- high: `importante`, `alta`, `prioritário`, `!`, `!p2`, `p2`, `!high`
- medium: `média`, `normal`, `!p3`, `p3`
- low: `baixa`, `quando der`, `qualquer hora`, `!p4`, `p4`
- Regex tolerante a acento e maiúsculas; remove o token do título.

**Status — vocabulário ampliado**
- in_progress: `em andamento`, `em progresso`, `fazendo`, `fazendo agora`, `começando`, `wip`, `[wip]`, `[em progresso]`
- backlog: `backlog`, `pro backlog`, `ideia`, `talvez`, `quem sabe`, `algum dia`, `[backlog]`
- done: `feito`, `pronto`, `concluído`, `concluido`, `terminei`, `[done]`, `[x]`
- todo: `[ ]`, `a fazer`, `fazer`

**Horário (novo)** → `due_time` (HH:MM:SS)
- `14h`, `14h30`, `às 9`, `às 9h`, `9:30`, `9:30am`, `2pm`, `meio-dia`, `meia-noite`, `manhã` (09:00), `tarde` (14:00), `noite` (19:00)
- chrono-node já entende muitos; complementar com regex pt para `14h`, `às 14h30`.

**Recorrência (novo)** → `recurrence_rule` (RRULE simples) + `recurrence_days`
- `toda segunda/terça/.../domingo`, `todo dia`, `diariamente`, `diária`, `#diaria`
- `toda semana`, `semanalmente`, `#semanal` → WEEKLY
- `todo mês`, `mensalmente`, `#mensal` → MONTHLY
- `dias úteis`, `seg a sex` → WEEKLY BYDAY=MO,TU,WE,TH,FR
- `fim de semana` → SA,SU
- `a cada 2 semanas`, `a cada 3 dias` → INTERVAL
- Reusar formato usado em `useRecurrence`.

**Projeto (novo)** → `project_id` via `entity_links` (após criar a tarefa)
- `@nome-do-projeto` (case-insensitive, match parcial em projetos não arquivados).
- Retorna `projectMatch: { id, title } | null`; submit cria o link `task → project`.

**Tags (novo)** → strip do título
- `#tag` extrai array `tags: string[]`. Tasks não têm coluna `tags` hoje — por enquanto **só remove do título** e ignora; nota no plano: adicionar coluna `tags` em migração futura se o usuário pedir persistência. (Confirmar abaixo.)

**Data**
- Continuar com `chrono.pt` mas processar **depois** dos outros, sobre o texto já limpo, pra não confundir `p1`/`#diaria` com datas.
- Combinar com horário detectado: se `due_time` extraído e `due_date` null, default = hoje.

**Auto-triage de status** (sem status explícito)
- `due_date` ≤ hoje → `todo`
- `due_date` futura → `backlog`
- Sem data + prioridade urgent/high → `todo`
- Sem nada → `todo`

**Retorno**
```ts
{ title, due_date, due_time, status, priority, recurrence_rule, recurrence_days, project_match, tags }
```

### 2. Submit do QuickAdd (`src/components/tasks/QuickAddTaskRow.tsx`)
- Passar os novos campos para `createTask`.
- Se `project_match`, após criar a task chamar `createEntityLink({ source_id: task.id, source_type:'task', target_id: project.id, target_type:'project' })`.
- Toast curto: `"Tarefa criada · 🚩 Alta · 📅 Amanhã 14:30 · 🔁 Semanal · 📁 Trabalho"` (só mostra chips dos campos detectados).
- Placeholder atualizado: `"ex: Reunião @trabalho amanhã 14h !alta toda semana"`.

### 3. Botão IA sob demanda (toggle)
- Adicionar ícone ✨ à direita do input (visível ao focar).
- Hover: tooltip `"Interpretar com IA (Ctrl+I)"`.
- Click ou Ctrl/Cmd+I: chama edge function `parse-task-ai`.
- Estado loading no botão; preenche o texto não, mas **cria direto** a tarefa com o resultado (conforme escolha do usuário).

### 4. Edge function `supabase/functions/parse-task-ai/index.ts`
- Recebe `{ text, projects: [{id,title}], today: "YYYY-MM-DD", timezone }`.
- Chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com tool calling estruturado retornando o mesmo shape do parser local + `project_id`.
- System prompt: extrair título, due_date, due_time, status, priority, recurrence_rule (RRULE), recurrence_days, project_id, tags em português brasileiro.
- Trata 429/402 → mensagem amigável; fallback pro parser local.
- `verify_jwt = false` para chamada simples do client autenticado.

### 5. Testes manuais cobrindo
- "Comprar pão amanhã 8h !urgente"
- "Reunião @trabalho toda segunda às 9h por 1h"
- "Estudar inglês dias úteis 19h"
- "Revisar PR importante hoje à tarde"
- "Talvez aprender rust algum dia #estudo"
- "[wip] refatorar componente"

### Pergunta antes de implementar
Tags em tarefas: **(a)** só remover do título por enquanto, ou **(b)** adicionar coluna `tags text[]` em `public.tasks` via migração e persistir? Vou assumir **(a)** se não responder.

### Arquivos
- editar: `src/lib/parseTaskInput.ts`, `src/components/tasks/QuickAddTaskRow.tsx`
- criar: `supabase/functions/parse-task-ai/index.ts`, atualizar `supabase/config.toml`
- (opcional, se confirmar tags): migração + `src/types/entities.ts` + `src/lib/api/tasks.ts`
