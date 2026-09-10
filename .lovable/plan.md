# NexusGraph — Descrição completa do aplicativo

O **NexusGraph** é um workspace pessoal conectado por IA que une quatro tipos de conteúdo — **notas, tarefas, projetos e produtos (Radar)** — em um único sistema onde tudo pode ser linkado entre si, visualizado em grafo e consultado por um assistente de IA que entende o contexto de tudo. O app funciona online e offline (cache local), em desktop e mobile, com login por e-mail.

---

## 1. Estrutura de navegação

Menu lateral (redimensionável e recolhível, arrastando a borda) com:

- **Dashboard** — visão geral do dia
- **Notas** — base de conhecimento
- **Tarefas** — gerenciador de tarefas
- **Projetos** — projetos com subprojetos ilimitados
- **Grafo** — mapa visual das conexões
- **Arquivos** — itens arquivados
- **Sugestões IA** — conexões sugeridas pela IA (badge com contador)
- **Radar: Pipeline / Aprovados** — funil de análise de produtos (badge com produtos aguardando decisão)
- **Configurações** — parâmetros do Radar e indexação da IA

No mobile, o menu vira uma gaveta acessível pelo botão no topo.

## 2. Captura rápida (Caixa)

Botão flutuante "+" (atalhos `Shift+N` ou `Shift+Espaço`) abre a **Caixa de captura**: você escreve qualquer coisa em linguagem natural ("ligar pro fornecedor amanhã às 14h", "ideia: post sobre...") e a IA classifica e formata automaticamente como **nota, tarefa ou projeto**, atribuindo título, data e prioridade. Funciona também por voz/ditado do teclado.

## 3. Notas

- Editor com markdown, wikilinks (`[[nome da nota]]`) que criam links automáticos
- Título, emoji, cor, tags, fixar no topo, arquivar
- Busca, importação de arquivos Markdown (com frontmatter) e exportação
- Painel de **conexões** para linkar a nota a tarefas, projetos e produtos
- **Sugestões relacionadas** da IA na própria nota

## 4. Tarefas

- Visões em **lista e quadro (board)**, com agrupamento e ordenação
- Status (backlog, a fazer, em andamento, feito, cancelado), prioridade, data e hora de vencimento, tempo estimado, subtarefas
- **Recorrência** (regras e dias da semana)
- Notificações de tarefas vencendo
- **Triagem automática** de itens da caixa de entrada
- Entrada rápida com parsing inteligente ("pagar boleto sexta !alta")
- Atalhos de teclado, drawer para mover tarefas, links bidirecionais com notas/projetos/produtos

## 5. Projetos

- **Hierarquia ilimitada de subprojetos** com árvore expansível e breadcrumbs
- Progresso calculado recursivamente (tarefas do projeto + todos os subprojetos)
- Status (ativo, pausado, concluído, arquivado), datas de início/alvo, cor e emoji
- Página interna com **narrativa do projeto**, abas de tarefas e notas vinculadas e **painel de IA** do projeto

## 6. Radar de Produtos (funil de análise de compra)

Kanban com 4 colunas: **Prospecção → Aguardando Custo → Aguardando Decisão → Decisão**, com drag-and-drop.

- **Cards densos** (10+ visíveis por coluna) com score, badge de decisão, pilares e modo expandido (global ou individual)
- **Janela do produto** (pop-up flutuante): abas Produto/Mercado/Notas, score recalculado em tempo real ao editar, histórico automático de cada alteração, edição em qualquer etapa, exclusão, arquivamento e **"Criar cópia"** (clona o produto com tag CÓPIA e link bidirecional ao original)
- **Score modular e configurável**: pilares padrão (margem, ticket, demanda, visitas, concorrentes) + **pilares customizados** que você cria; pesos relativos, faixas de pontuação com interpolação, thresholds de decisão (escala/descarte) e descartes automáticos — tudo em Configurações → Radar, com **recálculo de todos os produtos** ao salvar
- Campos numéricos aceitam vírgula ou ponto (formato brasileiro)
- **Filtros avançados** com busca por texto, decisão, score e sinais
- **Sinais automáticos** (regras determinísticas): alertas como "produto parado há X dias", exibidos no painel de insights
- **Solicitar orçamento**: janela pop-up que gera **PDF formal** com os dados do produto, seletores de "Meus dados" (sua empresa) e "Fornecedor", com **CRUD completo de empresas e fornecedores** cadastrados
- **Aprovados**: tabela de compras com edição inline de quantidade e status, subtotal por produto (custo × quantidade), **seleção múltipla com barra de total da compra** e ação em lote, exportação **CSV** compatível com Excel (campos escolhíveis)
- Integração total: produtos aparecem no grafo, podem ser linkados a notas/tarefas/projetos e criados a partir de notas

## 7. Grafo

Mapa visual interativo de todas as entidades e seus links (notas em uma cor, tarefas, projetos, produtos em âmbar). Permite navegar pelas conexões e abrir qualquer item.

## 8. IA integrada (NexusBot)

- **Botão flutuante de IA** em todas as telas: chat em janela pop-up onde você pergunta qualquer coisa sobre suas notas, tarefas, projetos e produtos — a IA busca semanticamente no seu conteúdo e responde com contexto
- **Sugestões de conexão**: a IA identifica relações prováveis entre itens e lista em "Sugestões IA" para você aceitar ou descartar; sugestões relacionadas aparecem também dentro de cada nota/tarefa
- **Indexação semântica** automática de tudo que é criado/editado, com botão de reindexação geral em Configurações → IA
- IA também atua na captura rápida (classificação) e no parsing de tarefas

## 9. Janelas flutuantes (pop-ups)

Orçamento, ficha do produto, histórico, exportação, importação e o chat da IA são **janelas flutuantes**: arrastáveis, redimensionáveis (8 direções), minimizáveis (ficam numa dock) e maximizáveis. Posição e tamanho são **lembrados por janela**, inclusive no mobile e ao girar a orientação da tela.

## 10. Sistema e conta

- Login/cadastro por e-mail; todos os dados são privados por usuário
- **Offline-first**: cache local com sincronização, banner de "sem conexão"
- PWA instalável (ícone na tela inicial do celular)
- Paleta de comando, revisão semanal, arquivo unificado de itens arquivados
- Tema consistente em toda a interface (tokens de design)

---

## Fluxos típicos (como fazer)

1. **Capturar algo rápido**: `Shift+N` → escrever → a IA decide se vira nota, tarefa ou projeto.
2. **Analisar um produto**: Radar → novo produto → preencher abas → acompanhar score e badge → arrastar pelas colunas → aprovar.
3. **Comprar**: aba Aprovados → ajustar quantidades → marcar produtos → ver o total da compra → exportar CSV ou gerar PDF de orçamento.
4. **Conectar conhecimento**: abrir qualquer item → painel Conexões → linkar; ou aceitar sugestões da IA.
5. **Perguntar à IA**: botão flutuante → "quais produtos têm margem acima de 30%?" ou "o que tenho para fazer essa semana?".
6. **Configurar o score**: Configurações → Radar → ajustar pesos, faixas e pilares customizados → recalcular tudo.
