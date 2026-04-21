
Objetivo

Fazer o editor de notas funcionar como um outline estilo Obsidian:
- títulos H1/H2/H3 definem seções hierárquicas
- tudo abaixo do título pertence àquela seção até surgir outro título de nível igual ou superior
- uma seta ao lado do título recolhe/expande toda a subseção, incluindo subtítulos
- o estado recolhido continua salvo por nota ao recarregar a página

Problema identificado

A implementação atual está frágil porque tenta esconder conteúdo alterando o DOM manualmente (`style.display = "none"`) por fora do estado do editor. Como o ProseMirror/TipTap controla esse DOM, ele pode re-renderizar e invalidar essas mudanças. Além disso, as setas estão desenhadas numa camada separada, fora da estrutura semântica do documento, o que deixa o comportamento visual inconsistente.

O que vou corrigir

1. Substituir o folding “na marra” por uma solução nativa do editor
- Reescrever o sistema de folding para trabalhar a partir do documento do TipTap/ProseMirror, não do DOM renderizado.
- Calcular a hierarquia percorrendo os nós do documento e determinando, para cada heading, qual intervalo de conteúdo pertence à sua seção.
- Aplicar o recolhimento com uma abordagem compatível com o editor, usando plugin/decorations/node views, para que o conteúdo fique realmente oculto de forma estável.

2. Trocar a seta em overlay por uma seta ligada ao próprio heading
- Remover a dependência do overlay absoluto para o comportamento principal.
- Renderizar a seta junto do título, com posicionamento confiável e clique previsível.
- Garantir que H2/H3 também tenham seta própria e que um H2 fique contido logicamente dentro do H1 anterior.

3. Persistir o estado por nota
- Manter a persistência por `localStorage` com chave por nota (`note:${id}`), mas agora baseada em um identificador estável do heading dentro do documento.
- Reaplicar automaticamente o estado salvo ao abrir/reabrir a nota.

4. Garantir entrada por Markdown e toolbar
- Confirmar que a criação de headings funciona tanto pelo toolbar quanto pela sintaxe Markdown (`#`, `##`, `###`).
- Ajustar a configuração do editor se necessário para não haver conflito entre extensões.

5. Corrigir sinais de instabilidade do editor
- Revisar a configuração de extensões do TipTap para eliminar o aviso de extensão `link` duplicada.
- Garantir que a recriação do editor não apague o estado visual do folding.

6. Validar com teste real end-to-end
- Criar/usar uma nota real com estrutura:
  - H1
    - texto
    - H2
      - texto
      - H3
        - texto
- Testar:
  - recolher H3 esconde só a subseção do H3
  - recolher H2 esconde H2 + H3 + conteúdos internos
  - recolher H1 esconde tudo até o próximo H1
  - expandir restaura corretamente
  - recarregar a página preserva o estado da nota

Arquivos que devem ser ajustados

- `src/components/ui/RichTextEditor.tsx`
- `src/hooks/useHeadingFold.ts` ou substituição por uma extensão/plugin dedicada
- `src/index.css`
- arquivo(s) de teste para validar a lógica de hierarquia/folding

Resultado esperado

Depois da correção:
- as setas aparecem de forma consistente ao lado dos títulos
- o clique recolhe/expande visualmente de verdade
- a hierarquia H1 > H2 > H3 funciona corretamente
- um novo H1 encerra a seção do H1 anterior
- o estado recolhido permanece salvo ao reabrir a nota

Detalhes técnicos

```text
Documento
H1 A
  parágrafo
  H2 B
    parágrafo
    H3 C
      parágrafo
H1 D
  parágrafo
```

Regras:
- seção de `H1 A` = tudo até `H1 D`
- seção de `H2 B` = tudo até próximo `H1` ou `H2`
- seção de `H3 C` = tudo até próximo `H1`, `H2` ou `H3`

Estratégia:
- ler headings diretamente do estado do editor
- mapear intervalos por nível
- marcar os blocos do intervalo como ocultos por decoration/classe controlada pelo plugin
- acoplar o toggle ao próprio heading
- persistir os headings recolhidos por nota
```