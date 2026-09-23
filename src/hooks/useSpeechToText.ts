import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/* Web Speech API não está tipada no lib padrão do TS */
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike extends Event { error: string }
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechToTextOptions {
  /** Chamado com cada trecho finalizado pelo reconhecedor. */
  onFinal: (text: string) => void;
  lang?: string;
}

export function useSpeechToText({ onFinal, lang = "pt-BR" }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const isSupported = useRef<boolean>(!!getCtor()).current;

  const stop = useCallback(() => {
    manualStopRef.current = true;
    setInterim("");
    setIsListening(false);
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      toast.error("Seu navegador não suporta ditado por voz. Tente pelo Chrome ou Edge.");
      return;
    }
    if (recRef.current) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    manualStopRef.current = false;

    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript || "";
        if (r.isFinal) {
          const clean = txt.trim();
          if (clean) onFinalRef.current(clean);
        } else {
          pending += txt;
        }
      }
      setInterim(pending);
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        manualStopRef.current = true;
        toast.error("Microfone bloqueado. Libere o acesso ao microfone nas permissões do navegador.");
      } else if (e.error === "audio-capture") {
        manualStopRef.current = true;
        toast.error("Nenhum microfone encontrado.");
      } else if (e.error === "network") {
        manualStopRef.current = true;
        toast.error("Sem conexão para transcrever a fala.");
      }
    };

    rec.onend = () => {
      setInterim("");
      if (manualStopRef.current) {
        recRef.current = null;
        setIsListening(false);
        return;
      }
      // o navegador encerra sozinho de tempos em tempos — retomar
      try {
        rec.start();
      } catch {
        recRef.current = null;
        setIsListening(false);
      }
    };

    try {
      rec.start();
      recRef.current = rec;
      setIsListening(true);
    } catch {
      toast.error("Não foi possível iniciar o ditado.");
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, []);

  return { isSupported, isListening, interim, start, stop, toggle };
}
