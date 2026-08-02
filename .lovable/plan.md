# Onda 3 — Unificação e polimento UI/UX

Revisei o estado atual do código. As Ondas 1 e 2 continuam aplicadas: código morto removido, toasts só em Sonner, `PageHeader` usado em 9 páginas, tokens `--score-*` em uso e `useEntityDetail` já compartilhado pelos três hooks de detalhe. Sobraram quatro frentes de duplicação e um resíduo de cores fora do design system.

## 1. Sistema de links: uma fonte só

Hoje existem dois caminhos para a mesma tabela `entity_links`:
- `lib/api/links.ts` + `useLinks.ts` (notas, tarefas, projetos)
- `hooks/radar/useRadarEntityLinks.ts` (produtos), com merge source/target próprio

E duas UIs para a mesma função: `LinkPanel` + `LinkPicker` (212 linhas) e `PainelConexoes` do Radar (255 linhas), sem nada compartilhado.

Ação: `useRadarEntityLinks` passa a consumir `fetchEntityLinks/createLink/deleteLink` de `lib/api/links.ts`; `PainelConexoes` vira um wrapper fino sobre `LinkPanel`/`LinkPicker` (mantendo o visual atual do sheet do produto). Comportamento e dados não mudam.

## 2. Busca de entidades unificada

`useEntitySearch` já existe e é usado só pelo Command Palette. `LinkPicker` ainda faz `ilike` próprio, e Notas/Tarefas têm filtros paralelos. Ação: `LinkPicker` passa a usar `useEntitySearch`, garantindo que ⌘K e o seletor de links devolvam os mesmos resultados.

## 3. Diálogos de criação compartilhados

`Notes.tsx` e `Projects.tsx` reimplementam cada um o próprio `Dialog` de criação. Ação: extrair um `CreateEntityDialog` com campos configuráveis, usando `useQuickCreate` (já centralizado), e reaproveitar nas duas páginas.

## 4. Últimas cores fora do design system

Restam classes cruas em: `Graph.tsx` (6 ocorrências, incluindo `bg-[#09090b]` e `text-white`), `Caixa.tsx` (4), `ProjectNarrative.tsx` (3), `TaskRow.tsx` (1), `NexusBot.tsx` (1). Ação: migrar para `--score-*`, `info`, `success`, `warning`, `muted`. No grafo 3D, mover as cores de nó para constantes derivadas dos tokens.

## 5. Polimento UI/UX

- **Loading**: `Archive.tsx` ainda usa spinner de página — trocar por Skeleton (padrão nas demais telas). Os spinners restantes são de botão e ficam como estão.
- **Densidade e espaçamento**: padronizar padding de card em `p-4` (listas) e `p-6` (painéis), corrigindo os pontos divergentes de Radar e Projetos.
- **Descoberta de features**: o atalho de parâmetros do Radar já existe no header; adicionar dica visual de drop nas listas (Notas/Tarefas) para o `ImportDropzone`, hoje invisível.
- **Fila de sugestões**: deixar explícito no dock (`RelatedSuggestions`) que é a mesma fila de `/suggestions`, com link "ver todas".

## Detalhes técnicos

- Arquivos tocados: `hooks/radar/useRadarEntityLinks.ts`, `components/radar/PainelConexoes.tsx`, `components/LinkPanel.tsx`, `components/LinkPicker.tsx`, `hooks/useEntitySearch.ts`, novo `components/CreateEntityDialog.tsx`, `pages/Notes.tsx`, `pages/Projects.tsx`, `pages/Graph.tsx`, `pages/Archive.tsx`, `components/Caixa.tsx`, `components/projects/ProjectNarrative.tsx`, `components/tasks/TaskRow.tsx`, `components/NexusBot/NexusBot.tsx`, `components/RelatedSuggestions.tsx`.
- Sem migrações de banco e sem mudança de regra de negócio: score, pipeline e IA permanecem intactos.
- Ao final: typecheck e verificação visual das telas afetadas via preview.
