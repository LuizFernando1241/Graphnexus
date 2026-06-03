## Visão geral

Adicionar export individual (`.md`) na página de detalhe de cada entidade e importação (`.md` ou `.zip`) por drop-in nas listas + uma página dedicada "Importar" com preview.

## Formato do arquivo `.md`

Frontmatter YAML + corpo Markdown. Links entre entidades usam wikilinks `[[Título]]` (estilo Obsidian). Anexos são baixados e referenciados via caminho relativo dentro de um `.zip` (quando a entidade tem arquivos).

**Nota**
```markdown
---
lovable_type: note
id: 5f2a...
title: Reunião de produto
emoji: 📝
color: "#7C3AED"
tags: [produto, semanal]
pinned: false
created_at: 2026-05-01T10:00:00Z
updated_at: 2026-06-03T14:00:00Z
links:
  - { type: project, title: "Roadmap Q3" }
  - { type: task, title: "Definir OKRs" }
attachments:
  - attachments/briefing.pdf
---

# Reunião de produto

Conteúdo convertido de HTML→MD…
Ver [[Roadmap Q3]] e [[Definir OKRs]].
![briefing](attachments/briefing.pdf)
```

**Tarefa** — frontmatter com `status`, `priority`, `due_date`, `due_time`, `estimated_minutes`, `recurrence_rule`, `recurrence_days`. Subtasks viram `- [ ]` / `- [x]` no corpo.

**Projeto** — frontmatter com `status`, `start_date`, `target_date`. Corpo inclui descrição + seções "Tarefas vinculadas" e "Notas vinculadas" com wikilinks.

Quando a entidade não tem anexos → download direto de `.md`. Quando tem → download `.zip` com `entity.md` + `attachments/`.

## Exportação (item único)

Botão "Exportar como Markdown" no menu (⋯) das páginas de detalhe (`NoteDetail`, `TaskDetail`, `ProjectDetail`).

Pipeline em `src/lib/markdown/export.ts`:
1. `entityToMarkdown(entity, links, attachments)` — gera frontmatter + corpo.
2. Para notas: HTML → MD via `turndown` (lib já comum no ecossistema; adicionar como dep).
3. Resolve `entity_links` → busca títulos das entidades alvo para gerar `[[Título]]`.
4. Detecta anexos: regex em `<img src>` / links apontando para `nexus_files` → baixa via `supabase.storage.from('nexus_files').download(path)`.
5. Sem anexos → `saveAs(blob, 'titulo.md')`. Com anexos → monta `.zip` com `jszip` e `saveAs(zip, 'titulo.zip')`.

Deps novas: `turndown`, `jszip`, `file-saver`, `js-yaml`.

## Importação

**Drop direto nas listas** (`Notes`, `Tasks`, `Projects`):
- Wrapper `<ImportDropzone entityType="note">` que aceita `.md` ou `.zip`.
- Parser detecta `lovable_type` no frontmatter. Se conflitar com a página (ex.: drop de tarefa na lista de Notas), pergunta confirmação.
- Sem frontmatter → cria nota usando filename como título.
- Cria a entidade imediatamente e dá toast com link.

**Página dedicada `/import`** (acessível pela sidebar, ícone Upload):
- Drop de múltiplos `.md` ou um `.zip`.
- Mostra **preview tabular**: tipo, título, status, conflitos detectados (id já existe).
- Para cada item, ação: **Criar novo**, **Substituir existente**, **Pular**.
- Botão "Importar N itens" executa em lote.

Pipeline em `src/lib/markdown/import.ts`:
1. Parse frontmatter (`js-yaml`) + corpo.
2. Body → HTML (notas) via `marked` + `DOMPurify` (já alinhado com `RichTextEditor`).
3. Tarefas: regex de `- [ ] texto` → `subtasks[]`.
4. Anexos do zip → upload via `uploadFile` (storage.ts), substitui referências no conteúdo.
5. Wikilinks `[[Título]]`: após criar todas as entidades do batch, resolve por título e cria `entity_links`. Wikilinks que não casam ficam como texto (mostra aviso no preview).

## Estrutura de arquivos

- `src/lib/markdown/frontmatter.ts` — serialize/parse YAML.
- `src/lib/markdown/export.ts` — `exportNote`, `exportTask`, `exportProject`.
- `src/lib/markdown/import.ts` — `parseMarkdownFile`, `importBatch`.
- `src/lib/markdown/wikilinks.ts` — extract/resolve `[[...]]`.
- `src/components/import/ImportDropzone.tsx` — drop area reutilizável.
- `src/components/import/ImportPreviewTable.tsx` — tabela de preview da página dedicada.
- `src/pages/Import.tsx` — página dedicada com preview e ações por linha.
- `src/components/EntityExportMenuItem.tsx` — item de menu reutilizável usado nos 3 detalhes.

## Mudanças em arquivos existentes

- `NoteDetail.tsx`, `TaskDetail.tsx`, `ProjectDetail.tsx` — adicionar item "Exportar como Markdown" no menu de ações.
- `Notes.tsx`, `Tasks.tsx`, `Projects.tsx` — envelopar com `ImportDropzone` (overlay visual ao arrastar).
- `AppSidebar.tsx` — link "Importar" → `/import`.
- `App.tsx` — rota `/import`.

## Considerações técnicas

- **Sem backend novo**: tudo no cliente. Download/leitura de anexos passa pelo Supabase Storage já existente (`nexus_files`).
- **HTML ↔ MD**: usar `turndown` (HTML→MD) e `marked + DOMPurify` (MD→HTML). Tabelas e checkboxes habilitados.
- **IDs**: preservados no frontmatter para round-trip. Na importação, ID novo é gerado a menos que o usuário escolha "Substituir".
- **Performance**: parser e zip rodam em main thread; ok para volumes típicos (centenas de notas). Otimização para Web Worker fica fora do escopo inicial.
- **Segurança**: conteúdo MD passa por `DOMPurify` antes de salvar (mesma pipeline do editor atual).