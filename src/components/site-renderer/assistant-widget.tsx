"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import type { DesignSystem } from "@/lib/types";

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
}

export function AssistantWidget({
  projectId,
  companyName,
}: {
  projectId: string;
  designSystem: DesignSystem;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/assistant/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const body = await res.json();
      const answer: string = res.ok
        ? body.answer
        : "Je n'ai pas cette information. Vous pouvez contacter l'entreprise directement.";
      setHistory((h) => [...h, { role: "assistant", content: answer }]);
    } catch {
      setHistory((h) => [
        ...h,
        { role: "assistant", content: "Je n'ai pas cette information. Vous pouvez contacter l'entreprise directement." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 flex h-[26rem] w-80 flex-col overflow-hidden rounded-[var(--sf-radius-lg,1rem)] border border-black/10 bg-white shadow-2xl"
          >
            <div className="border-b border-black/10 bg-neutral-900 px-4 py-3 text-white">
              <p className="text-sm font-medium">Assistant {companyName}</p>
              <p className="text-xs text-white/60">Répond à partir des informations du site</p>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
              {history.length === 0 ? (
                <p className="text-xs text-neutral-500">Posez une question sur nos services, nos coordonnées…</p>
              ) : null}
              {history.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                      m.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-neutral-400" /> : null}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-black/10 p-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Votre question…"
                className="h-9 flex-1 rounded-md border border-black/10 px-2.5 text-sm outline-none focus:border-neutral-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className="flex h-13 w-13 items-center justify-center rounded-full bg-neutral-900 p-3.5 text-white shadow-xl"
        aria-label="Ouvrir l'assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </motion.button>
    </div>
  );
}
