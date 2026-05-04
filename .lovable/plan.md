## Objetivo

Corrigir o alinhamento visual do editor de notas para que título, parágrafos, listas, citações e demais blocos compartilhem a **mesma margem esquerda** (gutter visual), eliminando o efeito atual de "texto solto no meio da tela" e dando uma sensação consistente estilo Notion/Obsidian.

## Problemas identificados

Olhando a captura e o CSS atual (`src/index.css` + `RichTextEditor.tsx`):

1. **Gutter dos títulos vs. corpo do texto**
   Títulos H1–H6 recebem `padding-left: 1.5rem` (para reservar espaço ao chevron de fold), mas parágrafos, listas e tabelas **não** recebem o mesmo padding. Resultado: títulos começam mais à direita do que o corpo, e o corpo fica visualmente "desalinhado".

2. **Listas com indentação dupla**
   `<ul>/<ol>` usam `pl-6` (1.5rem) para os bullets, mas como não compartilham o gutter dos títulos, os bullets aparecem em uma coluna diferente da margem dos títulos. Na captura, a lista aparece bem para dentro enquanto o restante do texto começaria mais à esquerda.

3. **Coluna de leitura excêntrica**
   `max-w-3xl xl:max-w-4xl mx-auto` no editor centraliza o conteúdo, mas combinado com o gutter inconsistente dá a sensação de "texto flutuando no meio". Falta um padding lateral equilibrado e uma largura de leitura mais natural.

4. **Espaçamento vertical apertado**
   `mb-2` em parágrafos e `mt-4 mb-2` nos H1 deixam o ritmo visual denso e pouco legível em telas grandes.

5. **Input de título da nota desalinhado com o editor**
   O `<Input>` do título fica fora do card do editor, sem o mesmo padding lateral, então o título da nota e o primeiro H1 do corpo não se alinham verticalmente.

6. **Listas longas sem destaque hierárquico**
   Bullet único, sem variação por nível, e sem espaço para respiração — dificulta escanear (visível no print: 9 itens "colados").

## Mudanças

### `src/index.css` — alinhamento e ritmo

- Definir um **gutter único** (`--editor-gutter: 1.75rem`) usado por:
  - títulos H1–H6 (espaço para o chevron à esquerda)
  - parágrafos, listas, blockquotes, tabelas, code blocks, imagens
  Assim tudo compartilha a mesma margem esquerda visual.
- Listas: manter o bullet/numeral **dentro** do gutter (usar `list-style-position: outside` com `padding-left` calculado a partir do gutter) para que o texto da lista alinhe com parágrafos.
- Aumentar levemente o ritmo vertical:
  - `p { margin-bottom: 0.5rem; line-height: 1.7 }`
  - `h1 { margin-top: 1.5rem; margin-bottom: 0.75rem }`
  - `h2 { margin-top: 1.25rem; margin-bottom: 0.5rem }`
  - `h3 { margin-top: 1rem; margin-bottom: 0.375rem }`
  - `li { margin-bottom: 0.25rem }`
- Reduzir o "salto" do primeiro elemento: `:first-child` dos títulos sem `margin-top`.
- Ajustar o chevron de fold para ficar **dentro** do gutter, alinhado verticalmente com a baseline do título (não no meio do bbox).
- Ajustar blockquote e callouts (se houver) para também respeitarem o gutter.

### `src/components/ui/RichTextEditor.tsx` — largura e padding

- Substituir `max-w-3xl xl:max-w-4xl` por uma **largura de leitura responsiva mais generosa**:
  - mobile: full-width com `px-4`
  - md: `max-w-[720px]`
  - lg: `max-w-[820px]`
  - xl: `max-w-[920px]`
  - 2xl: `max-w-[1040px]`
  Mantém leitura confortável (~75–90 caracteres por linha) sem deixar o texto "perdido".
- Manter `mx-auto` para centralizar a coluna, mas alinhar com o título da nota (ver próximo item).
- Padding vertical um pouco maior (`py-6 md:py-8`) para dar respiro.

### `src/pages/NoteDetail.tsx` — alinhar header com o editor

- Envolver o bloco "emoji + título" em um wrapper com **a mesma `max-w-*` e `mx-auto`** do editor, de modo que o título da nota e o primeiro título do corpo fiquem em colunas alinhadas.
- Aplicar o mesmo padding horizontal do editor a esse header para casamento visual perfeito.
- Pequena revisão de espaçamentos do topo (gap entre breadcrumb → toolbar de ações → título → editor) para um ritmo mais limpo.

### `src/hooks/useHeadingFold.ts` — posicionamento do chevron

- Recalcular `left` do chevron em relação ao **gutter do editor** (e não à borda do heading), garantindo que ele fique sempre numa coluna fixa à esquerda dos títulos, mesmo em diferentes tamanhos.
- Pequeno ajuste de `top` para alinhar verticalmente com a primeira linha do título (centro da `line-height` do texto, não do bounding box).

## Resultado esperado

- Título da nota, H1/H2/H3 e parágrafos/listas/tabelas/imagens do corpo todos começam exatamente na **mesma coluna esquerda**.
- Bullets e numerais ficam à esquerda dessa coluna, dentro do gutter, sem empurrar o texto para fora.
- A coluna de leitura ocupa um bloco confortável e centralizado que cresce com o tamanho da tela, sem "ilha de texto" no meio do monitor.
- Chevron de fold fica numa coluna fixa, sem encostar no texto e sem causar shift quando aparece/desaparece.
- Ritmo vertical mais arejado, mais próximo de Notion/Obsidian.

## Arquivos impactados

- `src/index.css`
- `src/components/ui/RichTextEditor.tsx`
- `src/pages/NoteDetail.tsx`
- `src/hooks/useHeadingFold.ts`
