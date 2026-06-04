# Melhorias de Projetos — Pacote pequeno

Foco em duas frentes complementares: **UI/UX da página de detalhe do projeto** + **ferramentas internas** (métricas e IA), sem mexer na listagem.

## 1. UI/UX da página do projeto

Reorganizar `ProjectDetail.tsx` em um layout mais visual e escaneável.

### Header visual
- Faixa de capa colorida (já existe) virando um **hero compacto** com emoji grande, título, status em badge colorido e datas (início → alvo) na mesma linha.
- Linha de meta-info (criado em, última atualização, nº de tarefas vinculadas).
- Ações (Salvar / Exportar / Arquivar / Excluir) agrupadas em um menu mais limpo.

### Abas (Tabs)
Substituir o scroll vertical único por 3 abas:
- **Visão geral** — métricas + descrição + IA.
- **Tarefas** — lista das tarefas vinculadas ao projeto (via `entity_links`), com checkbox inline e botão "+ tarefa" que já cria e vincula.
- **Notas e arquivos** — notas vinculadas + anexos do projeto.

O painel direito de links (`LinkPanelDock`) continua disponível em todas as abas.

### Cards de métricas (aba Visão geral)
Quatro cards no topo:
1. **Progresso** — barra `% concluído` baseada em tarefas vinculadas (`done / total`).
2. **Contagem por status** — chips: Backlog · Em andamento · Concluídas (cores semânticas).
3. **Próximas datas** — até 3 próximas tarefas com `due_date`, ordenadas; clique abre a tarefa.
4. **Burndown / timeline** — mini gráfico de área (Recharts) mostrando tarefas restantes ao longo do tempo até `target_date`. Se não houver datas, mostra estado vazio amigável.

## 2. Ferramentas internas (IA + auto)

### Painel "IA do Projeto" na aba Visão geral
Card com 3 ações via uma única edge function `project-ai` (Lovable AI, modelo `google/gemini-3-flash-preview`):

- **Resumo do projeto** — IA lê descrição + títulos/status das tarefas e notas vinculadas e gera um resumo executivo (3-5 linhas). Resultado exibido no card, com botão "Salvar como nota" (cria nota vinculada).
- **Quebrar em milestones + tarefas** — a partir da descrição, IA propõe milestones (3-6) e tarefas sob cada um. Modal de preview com checkbox por item; ao confirmar, cria tarefas com `entity_link` ao projeto. Milestone vira prefixo no título (`[M1] ...`) — sem mudança de schema.
- **Status inteligente** — IA analisa progresso, datas e atividade e sugere mudança de status (ex.: `active → paused` se sem atividade há 14d, ou `→ completed` se 100% das tarefas done). Mostra sugestão + botão "Aplicar".

Cada ação é um `type` diferente no body da edge function; respostas estruturadas via tool calling (schemas pequenos). Tratamento de 429/402 com toast amigável.

## Detalhes técnicos

**Arquivos novos:**
- `supabase/functions/project-ai/index.ts` — edge function única com `type: 'summary' | 'milestones' | 'status'`.
- `src/components/projects/ProjectHero.tsx` — header visual.
- `src/components/projects/ProjectMetrics.tsx` — 4 cards de métricas + burndown (Recharts já está nas deps).
- `src/components/projects/ProjectAIPanel.tsx` — painel IA com as 3 ações.
- `src/components/projects/ProjectTasksTab.tsx` — lista de tarefas vinculadas com criação inline.
- `src/components/projects/ProjectNotesTab.tsx` — notas + anexos.
- `src/lib/api/projectStats.ts` — helpers `getLinkedTasks(projectId)`, `computeProgress`, `buildBurndownSeries`.

**Arquivos editados:**
- `src/pages/ProjectDetail.tsx` — reorganizar em hero + Tabs (shadcn `Tabs`), mover descrição/datas/cor para aba Visão geral, manter `LinkPanelDock`.
- `supabase/config.toml` — registrar nova função (`verify_jwt = true`).

**Sem migração de schema.** Tarefas vinculadas continuam via `entity_links` (`source_type='task'`, `target_type='project'`). Milestones são apenas convenção de prefixo no título.

**IA:** usa `LOVABLE_API_KEY` (já configurado). Tool calling com schemas curtos para milestones/status; resumo retorna texto puro.

**Fora de escopo (este pacote):** mudanças na listagem `/projects`, criação de tabela de milestones, gráficos mais avançados, mudanças em Notas/Tarefas globais.