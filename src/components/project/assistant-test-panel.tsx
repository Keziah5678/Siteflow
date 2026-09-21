"use client";

import { useState } from "react";
import { Send, Loader2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

interface Entry {
  role: "user" | "assistant";
  content: string;
}

export function AssistantTestPanel({ projectId, published }: { projectId: string; published: boolean }) {
  const [history, setHistory] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const question = input.trim();
    if (!question) return;
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
      setHistory((h) => [...h, { role: "assistant", content: body.answer ?? "Erreur." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!published) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title="Publiez votre site pour tester l'assistant"
        description="L'assistant répond à partir du contenu publié de votre site."
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Assistant IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Testez ici ce que vos visiteurs verront. L'assistant ne répond qu'à partir du contenu réel de votre site — jamais
          d'invention.
        </p>
      </div>
      <div className="min-h-64 space-y-2 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Posez une question comme le ferait un visiteur…</p>
        ) : null}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-raised"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Quels sont vos horaires ?" />
        <Button type="submit" loading={loading} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
