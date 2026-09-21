"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

const SUGGESTIONS = [
  "Rends le site plus premium.",
  "Change la couleur principale en noir.",
  "Ajoute davantage d'espace entre les sections.",
  "Ajoute une page FAQ.",
];

export function ModificationChat({
  projectId,
  initialMessages,
}: {
  projectId: string;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdRef = useRef(0);
  function nextLocalId() {
    localIdRef.current += 1;
    return `local-${localIdRef.current}`;
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    setLoading(true);
    const optimisticUser: Message = {
      id: nextLocalId(),
      conversation_id: "local",
      role: "user",
      content: text,
      structured_payload: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);
    setInput("");

    try {
      const res = await fetch(`/api/projects/${projectId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "La modification a échoué.");

      const replyText: string = body.clarification_needed || body.summary || "Modification appliquée.";
      setMessages((m) => [
        ...m,
        {
          id: nextLocalId(),
          conversation_id: "local",
          role: "assistant",
          content: replyText,
          structured_payload: null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (body.applied) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "La modification a échoué.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-medium">Modifier avec l'IA</h2>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Décrivez ce que vous voulez changer, en langage naturel.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="focus-ring rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-surface-raised hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-[var(--radius-md)] px-3.5 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface-raised text-foreground",
                )}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> L'IA modifie votre site…
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 px-4 text-xs text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ex : Rends la page d'accueil plus premium…"
          className="min-h-11 flex-1 resize-none"
          rows={1}
        />
        <Button type="submit" size="md" loading={loading} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
