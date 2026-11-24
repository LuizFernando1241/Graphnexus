# MVP do GraphNexus — documento + ajuste do app

## Etapa 1 — Documento de MVP (PDF em Arquivos)
Documento formal "MVP GraphNexus" com:
1. **Problema**: informações espalhadas (ideias, tarefas, projetos) e perda de contexto entre elas.
2. **Público-alvo**: profissional autônomo/pequeno empreendedor que organiza o dia sozinho (app de uma pessoa só).
3. **Proposta de valor**: "Escreva do jeito que pensar — o app organiza e conecta."
4. **Núcleo do MVP (fica)**:
   - Caixa de captura rápida (texto e voz) com IA que separa nota de tarefa.
   - Notas e Tarefas (criar, editar, concluir, arquivar).
   - Projetos com subprojetos e progresso.
   - Links entre itens + sugestões de conexão por IA.
   - NexusBot para perguntar sobre tudo.
   - Login com e-mail e Google.
5. **Fora do MVP (fica para depois)**: Grafo visual, importação/exportação Markdown, janelas flutuantes avançadas, modo offline completo, colaboração.
6. **Jornada principal**: entrar → capturar → revisar na Caixa → ver na lista → ligar a projeto → perguntar ao NexusBot.
7. **Métricas de sucesso**: % de capturas aceitas sem edição, itens criados por semana, tarefas concluídas, uso semanal do NexusBot, retenção de 4 semanas.
8. **Riscos e premissas**: custo de IA, privacidade (conteúdo vai ao provedor de IA), precisão da classificação.
9. **Roteiro**: MVP → v1.1 (Grafo, importação) → v2 (colaboração).

## Etapa 2 — Ajustar o app ao documento
- Menu lateral e celular: Início, Caixa/Dashboard, Notas, Tarefas, Projetos, Sugestões, Arquivos. **Grafo sai do menu** (página continua existindo, só escondida).
- Início focado na jornada: Caixa de captura no topo, tarefas de hoje, projetos em andamento, sugestões pendentes.
- Tela vazia guiada para novo usuário (3 passos: capture, revise, conecte).
- Remover sobras do Radar ainda presentes (links antigos para produtos na lista de links e trabalho de IA em segundo plano).
- Nada é apagado do banco; tudo reversível.

## Detalhes técnicos
- PDF gerado via script Python (reportlab) em /tmp, salvo em /mnt/documents/MVP_GraphNexus.pdf, páginas conferidas como imagem.
- Edições em AppSidebar, navegação mobile, Dashboard, LinkPanel (filtrar entity_type produto) e edge functions (embed-entity, scan-link-suggestions, nexus-chat) sem referências a radar.
- Verificação: build limpo + Playwright logado no Início e menu.
