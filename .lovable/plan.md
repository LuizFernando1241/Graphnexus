## Para quem é isso

Não é um power-user de produtividade. É:
- O **empresário** que entre uma reunião e outra pensa "tenho que falar com o contador sobre o DAS, e lembrar de mandar o contrato pro João até sexta".
- O **executivo** que sai de uma call com 4 follow-ups na cabeça e 30 segundos pra registrar antes da próxima.
- A **pessoa comum** que no meio do dia lembra "preciso pagar a luz amanhã, marcar o dentista, e anotar a ideia do presente da minha mãe".

Essas pessoas **não querem aprender um sistema**. Querem desabafar o cérebro num campo e que as coisas certas apareçam nos lugares certos. Se a IA pedir confirmação demais, vira fricção. Se errar e criar lixo, perde a confiança. O ponto de equilíbrio é: **a IA acerta o suficiente para o usuário só apertar Enter na maioria das vezes**, e quando erra, custa 1 toque corrigir.

---

## Princípios (revisados pra esse usuário)

1. **Zero curva de aprendizado.** Nada de comandos `/t`, `/n`, `/p`, sintaxe especial. Quem quiser, descobre. Quem não, nunca precisa.
2. **Default agressivo.** A IA decide o tipo, a data, a prioridade. Mostra o resultado já preenchido. Enter aceita. O usuário não escolhe nada se não quiser.
3. **Velocidade > perfeição.** Resposta visível em <1s (streaming + fallback local instantâneo). Melhor criar uma tarefa "mais ou menos certa" rápido do que a perfeita em 4s — porque a pessoa já trocou de tela.
4. **Erros baratos.** Toda criação feita por IA aparece com um "Desfazer" por 10s no toast, igual Gmail. Não é preciso ir atrás pra corrigir.
5. **Linguagem humana.** Nada de "draft", "kind", "confidence". A interface fala "tarefa", "nota", "projeto", "amanhã às 14h", "urgente".
6. **A IA aprende com correções, sem perguntar.** Se você sempre muda "média" pra "alta", ela passa a sugerir "alta". Em silêncio.

---

## A grande mudança

O botão **"+"** hoje abre um menu com 3 opções (Nota / Tarefa / Projeto). Isso já é uma decisão que o usuário não deveria ter que tomar.

**Vira uma coisa só: a Caixa.**

```text
┌─────────────────────────────────────────────────┐
│  O que está na sua cabeça?                      │
│  ┌───────────────────────────────────────────┐  │
│  │ ligar pro contador amanhã sobre o DAS     │  │
│  └───────────────────────────────────────────┘  │
│                                    Enter ↵      │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│ ✓ Tarefa criada                                 │
│   "Ligar pro contador sobre o DAS"              │
│   📅 amanhã  ·  🔥 média                        │
│   [Desfazer]  [Ajustar]                         │
└─────────────────────────────────────────────────┘
```

Pronto. Esse é 90% dos casos. Um pensamento, Enter, tarefa criada com data certa. O usuário fecha a Caixa e volta pro que estava fazendo.

### Quando o pensamento é maior

Usuário digita: *"reunião amanhã 10h com o time. preciso preparar a apresentação até hoje à noite, e mandar o link pro João depois"*

A Caixa mostra, antes mesmo de salvar:

```text
Vou criar 3 coisas:

📅 Reunião com o time          amanhã 10h
✓  Preparar apresentação        hoje, urgente
✓  Mandar o link pro João       depois da reunião

[Criar tudo ↵]   [Ajustar]   [Cancelar]
```

Um Enter cria as 3. Os 3 já vêm ligados entre si (mesmo contexto), e ligados ao projeto certo se a IA reconhecer (ex.: "time" → projeto recente "Reestruturação interna").

### Quando é uma ideia/lembrança solta

*"presente da minha mãe — talvez aquele livro que ela falou semana passada"*

Vira **nota**, não tarefa. Título sugerido: "Presente da minha mãe". A IA viu que não tem data, verbo de ação fraco, tom de memória → é nota. Se o usuário discordar, 1 clique converte em tarefa.

### Formatar texto bagunçado

Pessoa cola um wall of text de uma reunião ou de uma ideia. Botão **"Organizar com IA"** dentro da nota:
- Vira títulos, listas, destaca decisões e pendências.
- Sempre mostra o antes/depois. Aceitar ou voltar ao original em 1 clique.
- Pendências detectadas viram sugestão "criar como tarefa?" no rodapé.

---

## O que a IA precisa entender bem (não negociável)

Pra esse usuário não desistir, a IA tem que acertar essas coisas básicas **quase sempre**:

| Entrada | Saída esperada |
|---|---|
| "amanhã", "sexta", "dia 20", "próxima semana" | due_date correto, timezone do usuário |
| "9h", "às 14:30", "de manhã", "fim do dia" | due_time correto (manhã=09:00, tarde=14:00, noite=19:00, fim do dia=18:00) |
| "urgente", "importante", "quando der", "sem pressa" | priority: urgent / high / low / low |
| "toda segunda", "todo dia", "todo mês dia 5" | recurrence_rule correto |
| "@joão", "com o pedro", "pro contador" | tag/pessoa preservada no título, não vira projeto |
| Nome de projeto existente ("do projeto X", "no lançamento") | project_id vinculado |
| Verbo de ação (ligar, comprar, mandar, fazer) | é **tarefa** |
| Substantivo/ideia/observação sem ação | é **nota** |
| "novo projeto:", "lançar", "começar X" + escopo grande | é **projeto**, com tarefas iniciais sugeridas |

A IA recebe contexto: lista de projetos ativos do usuário, últimas 20 tarefas, fuso, hora atual. Sem isso ela chuta. Com isso, acerta.

---

## Arquitetura (curta)

### Backend — 3 edge functions

| Função | O que faz |
|---|---|
| `capture` | Recebe texto + contexto (projetos, hora, fuso). Devolve 1 ou N itens estruturados (tarefa/nota/projeto), com relacionamentos sugeridos. Streaming. Usa `google/gemini-3-flash-preview`. |
| `organize-note` | Recebe markdown bruto, devolve markdown organizado + lista de pendências detectadas. |
| `parse-task-ai` | Já existe. Vira fallback rápido quando `capture` falha ou quando o texto é claramente uma tarefa única e curta. |

Tudo passa por JWT do usuário. Nada de chave no client.

### Frontend — componentes

| Componente | Substitui | Função |
|---|---|---|
| `Caixa` (CaptureBar) | `QuickAdd` (menu "+") | Textarea única, auto-grow, Enter envia, Esc fecha. |
| `Resultado` (DraftPreview) | — | Card(s) já preenchidos com chips clicáveis. Aceita tudo com Enter. |
| `OrganizarComIA` | — | Botão no editor de nota, abre modal de diff simples. |
| `DesfazerToast` | toast atual | Toast com countdown de 10s e botão "Desfazer". |

### O que **não** muda

- Telas de tarefas, notas, projetos continuam iguais. Só ganham o ponto de entrada novo.
- NexusBot (botão de perguntar) continua. Caixa é pra **registrar**, NexusBot é pra **perguntar**. Empilhados, com tooltips claros: "Registrar algo" e "Perguntar à IA".

### Atalho universal

`Shift + Espaço` (ou clique no FAB): abre a Caixa de qualquer tela, com foco no campo. Pra quem usa muito, vira músculo.

---

## Aprendizado silencioso

Sem ML, sem treinamento. Só padrões simples em `localStorage`:

- Últimas 20 correções do usuário (campo alterado, valor antes, valor depois).
- Antes de chamar a IA, o frontend injeta as 3-5 correções mais frequentes como dica no system prompt:
  > "Esse usuário costuma marcar tarefas com 'lançamento' como prioridade alta."

Resultado: depois de 1 semana, a IA parece "ter pegado o jeito da pessoa". Sem cadastro, sem configuração.

---

## Confiança e segurança emocional

- **Desfazer sempre.** 10s no toast + histórico das últimas 20 capturas em uma página "Atividade recente da IA" (Configurações → IA), onde dá pra reverter mesmo depois.
- **Selo "✨ IA"** discreto em qualquer campo gerado. Hover/toque mostra o texto original que você escreveu. Clique reverte aquele campo.
- **Sem surpresas grandes.** Se a IA fica em dúvida (confiança baixa, ex.: texto ambíguo), ela **não cria 3 coisas**; cria 1 só e oferece "Parece que tem mais aqui — quer que eu separe?".
- **Modo offline.** Se a função IA cair (rate limit, 402, sem internet), o parser local atual cria a tarefa do mesmo jeito. O usuário nunca fica travado.
- **Sem coleta invasiva.** Texto cru não vai pra log de servidor por padrão. Só fica no device. Opcional ligar "ajudar a IA a melhorar" nas configurações.

---

## Roteiro de execução

### Fase 1 — A Caixa (essencial)
1. Edge function `capture` com streaming e contexto (projetos + hora + fuso).
2. Componente `Caixa` substituindo o menu do FAB "+".
3. `Resultado` com chips editáveis (data, hora, prioridade, projeto).
4. Toast com "Desfazer" de 10s.
5. Fallback local instantâneo.
6. Atalho `Shift+Espaço`.

**Pronto quando:** o usuário digita "comprar pão amanhã" e em <1s tem uma tarefa criada com data certa, sem clicar em nada além de Enter.

### Fase 2 — Organizar notas
1. Edge function `organize-note`.
2. Botão "Organizar com IA" no editor.
3. Modal antes/depois simples.
4. Pendências detectadas viram sugestão de tarefa no rodapé.

**Pronto quando:** texto colado de uma reunião vira markdown limpo com 1 clique, e as pendências viram tarefas vinculadas.

### Fase 3 — Inteligência relacional
1. Aproveitar embeddings (já existem) pra sugerir "Relacionado a..." quando criar algo.
2. Criar `entity_links` automaticamente ao aceitar.
3. Aprendizado por correções em localStorage.
4. Página "Atividade recente da IA" com reverter.

**Pronto quando:** ao criar "falar com Pedro sobre o contrato", aparece um chip "Relacionado: Projeto Contrato Acme" e dá pra vincular com 1 toque.

---

## Fora de escopo (anotado pra depois)

- **Voz** (ditar pelo microfone). Próxima rodada.
- **Resumo diário automático** ("o que mudou hoje", "o que vence amanhã").
- **Ghost text** enquanto digita (autocompletar inteligente).
- **Redesign de telas existentes** de tarefa/nota/projeto.
- **Multi-usuário / equipes.**

---

## Riscos reais e como mitigar

| Risco | Mitigação |
|---|---|
| IA acerta 70%, usuário desiste por causa dos 30% | Desfazer fácil + correções viram aprendizado + fallback local + nunca cria sem mostrar antes (quando >1 item) |
| Latência mata a sensação de mágica | Streaming + fallback local que aparece em <300ms enquanto a IA pensa |
| Empresário cético de IA acha "frescura" | Atalho do teclado e Enter resolvem tudo — funciona como um campo bobo de "criar tarefa" pra quem não quiser usar IA. A IA só some no fundo |
| Notas longas viram um diff assustador | Resumo em cima: "Adicionei 4 títulos, organizei em 3 seções, encontrei 2 pendências." Antes de ver o diff. |
| Custo de tokens vira problema | Gemini Flash Preview é barato. Cache de classificações curtas no client (texto idêntico → mesmo resultado, 24h). |

---

## Uma frase

Substituir o menu "+" por **uma única caixa de texto** onde o usuário escreve qualquer coisa em linguagem natural; a IA decide se é tarefa, nota ou projeto, preenche tudo (data, hora, prioridade, projeto), mostra o resultado já pronto, e cria com Enter — com "Desfazer" de 10 segundos pra qualquer erro nunca custar mais que um toque.
