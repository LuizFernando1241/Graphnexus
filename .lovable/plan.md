# Captura inteligente: decidir melhor e formatar certo

Hoje a Caixa faz tudo numa única passada: o modelo recebe o texto e já devolve o item pronto. O resultado é instável — às vezes vira tarefa o que era nota, e a formatação do conteúdo sai pobre ou inconsistente. O plano separa a decisão da formatação e corrige perdas de dados na criação.

## O que muda na prática

1. **Primeiro decide, depois formata.** A IA passa a trabalhar em duas etapas na mesma chamada: classificar cada trecho (tarefa, nota ou projeto) e só então escrever o conteúdo no formato próprio daquele tipo.
2. **Regras de decisão mais claras.** Critério objetivo: existe uma ação que você precisa executar, com responsável implícito e possibilidade de "concluir"? É tarefa. É informação para consultar depois? É nota. Texto misto vira nota + tarefas separadas, e a tarefa fica ligada à nota.
3. **Formatação por tipo de nota.** A IA escolhe um entre formatos definidos: registro de reunião, ideia, referência/link, lista/checklist, aprendizado, registro do dia. Cada um tem uma estrutura fixa (seções, listas, destaque de decisões e próximos passos), em markdown limpo, sem inventar informação que você não escreveu.
4. **Tarefas ficam completas.** O que você escreveu além do título vira descrição da tarefa em vez de ser descartado, com subtarefas quando o texto lista passos.
5. **Correções de perdas atuais:** as etiquetas (tags) que a IA identifica hoje somem ao criar tarefas; as tarefas iniciais de um projeto novo não ficam ligadas ao projeto. Ambos passam a ser gravados.
6. **Prévia melhor.** Antes de criar, a nota aparece com a formatação real (markdown renderizado) e dá para trocar o tipo do item (nota ↔ tarefa) num clique, sem reescrever o texto.

## Detalhes técnicos

- `supabase/functions/capture/index.ts`: reescrever o prompt em duas fases explícitas (classificação → formatação) com critérios de desempate e exemplos curtos; adicionar ao schema da tool os campos `note_format` (enum de formatos), `description` para tarefas, `subtasks`, `linked_to_index` (para ligar tarefa à nota do mesmo texto) e `reason` por draft. Manter `tool_choice` forçado e a sanitização de `project_id`.
- Validar no servidor: `due_date` em `YYYY-MM-DD`, `due_time` em `HH:MM:SS`, `status`/`priority` dentro dos enums, tags normalizadas (sem `#`, minúsculas, sem duplicatas), markdown sem blocos de código envolvendo a nota inteira. Valor inválido cai para `null` em vez de quebrar a criação.
- Regra de status/prioridade calculada em código a partir de `due_date` e `today`, não deixada só a cargo do modelo (evita divergência).
- `useQuickCreate.ts`: passar `tags` e `description`/`subtasks` em `createTask`; criar link `task → project` também para `tasks_initial`; devolver os ids criados para permitir o link entre nota e tarefas do mesmo texto.
- `Caixa.tsx`: renderizar a prévia da nota com markdown, botão para alternar o tipo do draft e exibir o motivo da classificação em tooltip.
- Manter o fallback local (`parseTaskInput`) quando a IA falhar, como já é hoje.

## Verificação

Testar com casos reais: texto só de ação, texto só informativo, texto misto com reunião e follow-ups, lista de passos, link com comentário, e texto com data relativa ("sexta às 9h"). Conferir tipo escolhido, formato aplicado, data/hora e etiquetas salvas.
