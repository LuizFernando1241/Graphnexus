
# IA Integrada com Contexto Global — Sugestão de Links

## Objetivo
Uma camada de IA que entende todo o conteúdo do workspace (notas, tarefas, projetos, produtos do radar) e identifica relações que ainda não existem como `entity_links`. O usuário recebe sugestões do tipo "esta nota fala do produto X — quer vincular?" e aprova com 1 clique.

## Como vai funcionar (visão de produto)

1. **Indexação semântica em background**
   Cada entidade (nota, tarefa, projeto, produto) vira um vetor (embedding) guardado no banco. Sempre que algo é criado/editado, o vetor é atualizado.

2. **Detector de links sugeridos**
   Uma edge function compara vetores + heurísticas (menções de nome, tags, palavras-chave) e gera sugestões de link entre entidades que ainda não estão conectadas. Cada sugestão tem score de confiança e uma justificativa curta gerada pela IA ("a nota menciona 'campanha Q3' que é o título deste projeto").

3. **Inbox de Sugestões**
   Nova seção no Dashboard + badge no sidebar: "X sugestões de link". Cada card mostra: entidade A ↔ entidade B, motivo, botões **Vincular** / **Ignorar**. Ignorar é lembrado para não reaparecer.

4. **Sugestões contextuais inline**
   - No drawer/página de uma nota, tarefa, projeto ou produto: bloco "Pode estar relacionado a…" com top 3 sugestões para *aquela* entidade.
   - No QuickAdd de tarefa e ao salvar nota: se a IA detecta forte relação com um projeto/produto, oferece auto-link antes de salvar.

5. **Chat com contexto global (Ask)**
   Command Palette ganha modo "Perguntar à IA": pergunta em linguagem natural ("o que eu tenho sobre fornecedor Y?") e a IA responde puxando notas/tarefas/produtos relevantes via busca por embedding (RAG), com links clicáveis para cada fonte citada.

## Arquitetura técnica

### Banco (1 migration)
- Habilitar `pgvector`.
- Tabela `entity_embeddings` (`entity_type`, `entity_id`, `user_id`, `content_hash`, `embedding vector(1536)`, `updated_at`) com índice HNSW e RLS por `user_id`.
- Tabela `link_suggestions` (`id`, `user_id`, `source_type/id`, `target_type/id`, `score`, `reason`, `status` enum: pending/accepted/dismissed, `created_at`). RLS + grants.
- Índice único `(user_id, source, target)` para não duplicar.

### Edge functions (Lovable AI Gateway — sem chave do usuário)
- **`embed-entity`**: recebe `{entity_type, entity_id}`, monta texto canônico da entidade, gera embedding com `google/gemini-embedding-001` (dimensions: 1536) e faz upsert em `entity_embeddings`. Pula se `content_hash` igual.
- **`scan-link-suggestions`**: para cada entidade nova/alterada, faz `match` por similaridade (top-K) entre tipos diferentes, filtra pares já linkados ou já dismissados, e pede a `google/gemini-3-flash-preview` para validar/justificar cada candidato. Grava em `link_suggestions`.
- **`ask-workspace`**: RAG — embed da pergunta, busca top-N entidades, monta contexto e responde streaming citando fontes.

### Front-end
- Hook `useEmbedOnSave`: dispara `embed-entity` ao criar/atualizar nota/tarefa/projeto/produto (fire-and-forget, debounce).
- `src/pages/Suggestions.tsx` (rota `/suggestions`) + item no sidebar com contagem.
- Componente `<RelatedSuggestions entityType entityId />` injetado em ProjectDetail, NoteDetail, TaskDetail e ProdutoDrawer.
- Mutations: `acceptSuggestion` (cria `entity_link` + marca accepted), `dismissSuggestion`.
- Command Palette: novo modo "?" para perguntar à IA, render markdown com fontes.

### Cron / disparo
- `scan-link-suggestions` roda: (a) sob demanda quando o usuário abre a Inbox; (b) automaticamente após `embed-entity` da entidade que mudou (escopo: só compara essa entidade contra as outras, barato).

## Custo / privacidade
- Embeddings e chamadas vão pelo Lovable AI Gateway (sem chave extra, cobrado em créditos do workspace).
- Tudo escopado por `auth.uid()` via RLS — IA nunca vê dados de outro usuário.
- Dismiss é persistente: a mesma sugestão não volta.

## Entrega em 3 fases

**Fase 1 — Fundação (essa primeira entrega)**
- pgvector + tabelas + RLS/grants
- `embed-entity` + hook de indexação em todas as 4 entidades
- Reindexação inicial (botão em Settings: "Reindexar workspace")

**Fase 2 — Sugestões de link**
- `scan-link-suggestions`
- Página `/suggestions` + badge no sidebar
- `<RelatedSuggestions />` nas páginas de detalhe

**Fase 3 — Ask workspace (RAG)**
- `ask-workspace` edge function
- Modo "Perguntar" no Command Palette com streaming e citações

## Confirmações antes de implementar
1. Posso começar pela **Fase 1 + Fase 2** nesta entrega (fundação + sugestões de link, que é o pedido principal) e deixar o chat RAG para a próxima?
2. OK usar **embeddings 1536-dim Gemini** via Lovable AI (consome créditos do workspace a cada save)?
3. Quer também o **auto-link inline** no QuickAdd de tarefa quando a IA tem confiança alta (>0.85), ou prefere que TODA sugestão passe pela Inbox antes?
