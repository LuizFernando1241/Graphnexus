# Ditado por voz na Caixa e no NexusBot

Adicionar um botão de microfone para falar e o texto aparecer no campo, sem custo de créditos: usa o reconhecimento de fala do próprio navegador (Chrome, Edge, Safari recente), em português do Brasil.

## Como vai funcionar

- Um ícone de microfone ao lado do campo de escrita, na Caixa e no chat do NexusBot.
- Clico no microfone, falo, e o texto vai aparecendo ao vivo no campo enquanto falo (é o modo mais barato: tudo acontece no aparelho, sem chamada de IA).
- Clico de novo (ou fico em silêncio por alguns segundos) para parar. O texto fica no campo, dá para editar antes de enviar.
- Enquanto grava: o botão fica em vermelho pulsando e aparece "ouvindo…". O texto ainda não confirmado aparece esmaecido.
- Se eu já tinha escrito algo, a fala é acrescentada ao final, não apaga.
- Atalho: segurar a barra de espaço não interfere; uso só o botão e um atalho de teclado simples no chat.
- Se o navegador não suportar (Firefox, alguns Android), o botão não aparece e, ao tentar, explico que o navegador não suporta ditado.
- Primeira vez: o navegador pede permissão do microfone. Se for negada, mostro um aviso claro explicando como liberar.

## Detalhes técnicos

- Novo hook `src/hooks/useSpeechToText.ts` encapsulando `SpeechRecognition` / `webkitSpeechRecognition`: `isSupported`, `isListening`, `interim`, `start()`, `stop()`, `onResult(finalText)`, `lang: "pt-BR"`, `continuous: true`, `interimResults: true`.
- Tratar erros `not-allowed`, `no-speech`, `audio-capture`, `network` com toast (Sonner) em linguagem simples; reinício automático quando o navegador encerra sozinho durante `continuous`, com parada definitiva após stop manual.
- Novo componente `src/components/ui/mic-button.tsx` (botão acessível com `aria-pressed`, `aria-label`, estados idle/gravando) reutilizado nos dois lugares.
- `src/components/Caixa.tsx`: microfone ao lado da textarea; texto final concatenado ao estado do input; interim mostrado como sobreposição/esmaecido; parar a escuta ao enviar ou fechar o diálogo.
- `src/components/NexusBot/NexusBot.tsx`: mesmo botão junto ao campo de mensagem; parar a escuta ao enviar.
- Tipagem: declarar as interfaces do Web Speech em `src/vite-env.d.ts` (ou no próprio hook) já que não estão no lib padrão do TS.
- Sem edge function nova e sem uso de créditos de IA.

## Verificação

Typecheck e teste no navegador: iniciar ditado na Caixa e no NexusBot, conferir texto ao vivo, parada manual, concatenação com texto já digitado e mensagem de permissão negada.
