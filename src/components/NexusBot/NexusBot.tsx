import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Plus, Send, Loader2, FileText, CheckSquare, FolderKanban, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FloatingWindow } from "@/components/ui/floating-window";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface EntityRef {
  entity_type: "note" | "task" | "project" | "produto" | string;
  entity_id: string;
  title: string;
  preview?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  entities?: EntityRef[];
}

const STORAGE_KEY = "nexus-bot-messages-v1";
const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Oi! Sou o **NexusBot** 🤖\n\nPergunte qualquer coisa sobre suas notas, tarefas, projetos e produtos. Por exemplo:\n\n- *Quais tarefas estão atrasadas?*\n- *Tenho alguma nota sobre marketing?*\n- *O que está acontecendo no projeto X?*\n- *Com o que essa nota se conecta?*",
};

function entityHref(e: EntityRef): string {
  switch (e.entity_type) {
    case "note": return `/notes/${e.entity_id}`;
    case "task": return `/tasks/${e.entity_id}`;
    case "project": return `/projects/${e.entity_id}`;
    case "produto": return `/radar`;
    default: return "/";
  }
}

function entityIcon(type: string) {
  switch (type) {
    case "note": return FileText;
    case "task": return CheckSquare;
    case "project": return FolderKanban;
    case "produto": return Package;
    default: return FileText;
  }
}

function entityLabel(type: string) {
  switch (type) {
    case "note": return "Nota";
    case "task": return "Tarefa";
    case "project": return "Projeto";
    case "produto": return "Produto";
    default: return type;
  }
}

export function NexusBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [WELCOME];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {/* ignore */}
    return [WELCOME];
  });
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {/* ignore */}
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 100);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const payload = next
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("nexus-chat", {
        body: { messages: payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.message?.content ?? "(sem resposta)",
        entities: data?.entities ?? [],
      };
      setMessages((m) => [...m, reply]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error("NexusBot: " + msg);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: `❌ ${msg}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  const reset = () => {
    setMessages([WELCOME]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {/* ignore */}
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Abrir NexusBot"
        onClick={() => setOpen(true)}
        className={cn(
          "relative h-14 w-14 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "flex items-center justify-center",
          "transition-transform hover:scale-105 active:scale-95",
          "ring-1 ring-primary/40",
        )}
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
      </button>

      <FloatingWindow
        open={open}
        onOpenChange={setOpen}
        defaultWidth={460}
        defaultHeight={640}
        bodyClassName="p-0 flex flex-col overflow-hidden"
        title={
          <span className="flex items-center gap-2.5">
            <span className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Bot className="h-3.5 w-3.5" />
            </span>
            NexusBot
            <Button variant="ghost" size="icon" className="h-6 w-6" onPointerDown={(e) => e.stopPropagation()} onClick={reset} title="Nova conversa">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </span>
        }
        description="Conhece todo o seu Nexus"
      >

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col gap-2",
                  m.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                {m.entities && m.entities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[88%]">
                    {m.entities.map((e) => {
                      const Icon = entityIcon(e.entity_type);
                      return (
                        <button
                          key={`${e.entity_type}-${e.entity_id}`}
                          onClick={() => {
                            setOpen(false);
                            navigate(entityHref(e));
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent text-xs px-2.5 py-1 transition-colors"
                          title={`${entityLabel(e.entity_type)}: ${e.title}`}
                        >
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{entityLabel(e.entity_type)}</span>
                          <span className="font-medium truncate max-w-[180px]">{e.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Pensando…
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Pergunte sobre suas notas, tarefas, projetos…"
                rows={1}
                className="min-h-[44px] max-h-32 resize-none text-sm"
                disabled={loading}
              />
              <Button
                onClick={send}
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Enter envia · Shift+Enter quebra linha
            </div>
          </div>
      </FloatingWindow>
    </>
  );
}
