## Objetivo

Fazer as páginas de Tarefas, Projetos e Arquivo se ajustarem à largura do monitor (responsivas), assim como já foi feito na aba de Notas — removendo as larguras máximas fixas que hoje "espremem" o conteúdo no centro em telas grandes.

## Diagnóstico

Comparando com `NoteDetail.tsx` (que usa `w-full` e o `LinkPanelDock` redimensionável), as outras telas ainda têm limitadores fixos:

- `src/pages/TaskDetail.tsx` (linha 122): wrapper usa `max-w-5xl`, limitando o conteúdo a ~1024px mesmo em telas 1440p/4K.
- `src/pages/ProjectDetail.tsx` (linha ~108): mesmo problema, wrapper usa `max-w-5xl`.
- `src/pages/Archive.tsx` (linha 197): wrapper usa `max-w-3xl`, limitando a lista a ~768px.
- `src/pages/Projects.tsx`: o grid já é responsivo (`sm:grid-cols-2 lg:grid-cols-3`), mas em monitores muito largos só vai até 3 colunas.
- `src/pages/Tasks.tsx`: o board já é responsivo (`md:grid-cols-2 xl:grid-cols-4`), sem limitadores. OK.

## Mudanças

### 1. `src/pages/TaskDetail.tsx`
- Remover `max-w-5xl` do container principal (linha 122). Substituir por `w-full`.
- Garantir que a `Input` do título e a `RichTextEditor` ocupem toda a largura disponível, alinhadas pelo mesmo gutter usado em Notes (mesma estratégia: `w-full`, sem max-w).

### 2. `src/pages/ProjectDetail.tsx`
- Remover `max-w-5xl` do container principal. Substituir por `w-full`.
- Manter o `LinkPanelDock` à direita (já redimensionável).

### 3. `src/pages/Archive.tsx`
- Remover `max-w-3xl` do wrapper.
- Adicionar grid responsivo para a lista de itens em telas largas:
  - mobile: 1 coluna
  - `md`: 2 colunas
  - `xl`: 3 colunas
- Mantém o mesmo visual em mobile, mas aproveita o espaço em desktop.

### 4. `src/pages/Projects.tsx` (ajuste fino opcional)
- Estender o grid em telas extra-largas: `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5` para aproveitar monitores grandes.

### 5. `src/pages/Tasks.tsx`
- Sem mudanças necessárias (já é responsivo).

## Resultado esperado

- Em monitores grandes (≥1440px), as telas Tarefas (detalhe), Projetos (detalhe e lista) e Arquivo passam a ocupar toda a largura útil disponível — exatamente como Notas.
- Em mobile/tablet o comportamento permanece idêntico (sem regressões).
- A barra de links lateral redimensionável (já implementada) continua funcionando nos detalhes de Tarefa e Projeto.
