# Assistente IA Global (NexusBot)

Botão flutuante fixo no canto inferior direito → abre um painel de chat que responde sobre notas, tarefas, projetos e produtos usando embeddings + tool calling.

## UX

- **Botão flutuante** (FAB) presente em todas as páginas autenticadas, canto inferior direito, com ícone customizado (não Sparkles genérico) e badge sutil.
- **Painel deslizante** (Sheet à direita, ~420px) com:
  - Header: nome "NexusBot" + botão fechar + botão "nova conversa"
  - Transcript com AI Elements (`Conversation`, `Message`, `MessageResponse`, `Tool`)
  - Composer (`PromptInput`) com placeholder "Pergunte sobre suas notas, tarefas, projetos..."
  - Resultados de ferramentas (entidades encontradas) clicáveis → navegam para a entidade
- **Persistência**: localStorage, uma conversa única (botão limpa). Sem threads — mais simples e suficiente para o caso de uso "perguntar qualquer coisa".

## Arquitetura

### Edge function `nexus-chat` (nova)
- Streaming via AI SDK (`streamText` + `toUIMessageStreamResponse`)
- Modelo: `google/gemini-3-flash-preview`
- System prompt: explica que é assistente do NexusGraph, deve usar ferramentas para buscar contexto antes de responder, citar entidades por título, sugerir links quando fizer sentido.
- **Tools expostas ao modelo**:
  1. `semantic_search({ query, limit })` — embed query → `match_entities` RPC → retorna top-N (entity_type, id, preview, similarity)
  2. `get_entity({ type, id })` — busca conteúdo completo (note body, task details, project, produto)
  3. `list_recent({ type, limit })` — últimas N entidades de um tipo (para "o que fiz essa semana?")
  4. `list_overdue_tasks()` — tarefas atrasadas do usuário
  5. `suggest_links({ type, id })` — top sugestões semânticas para uma entidade (reutiliza `match_entities` excluindo self)
- `stopWhen: stepCountIs(8)` para permitir múltiplas chamadas de tool em sequência.
- Auth: valida JWT do usuário em código, todas queries scoped por `auth.uid()` (via RLS no token).

### Frontend
- `src/components/NexusBot/FloatingButton.tsx` — FAB
- `src/components/NexusBot/ChatPanel.tsx` — Sheet + AI Elements
- `src/components/NexusBot/EntityChip.tsx` — chip clicável para resultados de tool (navega para `/notes/:id`, `/tasks`, `/projects/:id`, `/radar/produtos/:id`)
- `useChat` da AI SDK apontando para `${SUPABASE_URL}/functions/v1/nexus-chat`
- Mensagens persistidas em `localStorage` (`nexus-bot-messages`)
- Montar `<NexusBot />` no `AppLayout` (dentro do `ProtectedRoute`)

### AI Elements a instalar
`conversation`, `message`, `prompt-input`, `tool`, `shimmer`

## Pré-requisitos já existentes
- ✅ `entity_embeddings` + `match_entities` RPC (Parte anterior)
- ✅ `embed-entity` function para indexar
- ✅ `LOVABLE_API_KEY` configurado

## Não inclui (escopo futuro)
- Ações de escrita (criar/editar notas/tarefas via chat) — apenas leitura/sugestão nesta fase
- Threads múltiplas
- Voice input

## Critérios de aceite
- Botão visível em toda página autenticada
- Pergunta "quais tarefas atrasadas?" → IA chama `list_overdue_tasks` e responde com lista
- Pergunta "tem alguma nota sobre X?" → IA chama `semantic_search`, lista entidades como chips clicáveis
- Pergunta "esse projeto se conecta com o que?" → IA usa `suggest_links`
- Conversa persiste ao recarregar; botão "nova conversa" limpa
- Tool calls renderizam fechados por default (accordion)
