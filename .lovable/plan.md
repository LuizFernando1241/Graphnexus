## Corrigir links clicáveis no Rich Text Editor

**Causa:** em `src/components/ui/RichTextEditor.tsx`, a extensão `Link` está com `openOnClick: false` e não há handler customizado de clique, então cliques em links não fazem nada (embora o `href` esteja salvo corretamente).

**Correção em `src/components/ui/RichTextEditor.tsx`:**

1. Importar `useNavigate` de `react-router-dom`.
2. Dentro de `RichTextEditor`, obter `navigate = useNavigate()`.
3. Adicionar `handleClickOn` em `editorProps` do `useEditor`:
   - Procurar mark `link` no nó/posição clicada (via `editor.state.doc.nodeAt` + `marks`).
   - Se `href` começa com `/` → `navigate(href)` (SPA, sem reload) e retornar `true` para prevenir default.
   - Caso contrário (http, mailto, etc.) → `window.open(href, '_blank', 'noopener,noreferrer')` e retornar `true`.
   - Sem link no clique → retornar `false` (comportamento padrão de edição).
4. Manter `openOnClick: false` na config (nosso handler assume controle).

**Resultado:** clicar num link interno navega via SPA para a nota/tarefa/projeto; clicar num link externo abre em nova aba. Edição do link continua via toolbar (botão remover link) e seleção por teclado.