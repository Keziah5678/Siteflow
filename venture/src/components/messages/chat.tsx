"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Paperclip, SendHorizontal, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markConversationReadAction, sendMessageAction } from "@/lib/actions/social";
import { uploadPrivateFile } from "@/lib/upload";
import { Avatar, Notice } from "@/components/ui/primitives";
import { ReportButton } from "@/components/report-button";
import { cn, formatDate } from "@/lib/utils";

export type ChatMessage = { id: string; sender_id: string; body: string; attachment_path: string | null; attachment_name: string | null; created_at: string; pending?: boolean; failed?: boolean };
export type ChatPerson = { id: string; display_name: string; avatar_url: string | null };

export function Chat({ conversationId, viewerId, initial, people, disabledReason }: { conversationId: string; viewerId: string; initial: ChatMessage[]; people: ChatPerson[]; disabledReason?: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [connected, setConnected] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const byId = new Map(people.map((p) => [p.id, p]));

  // Realtime: RLS ensures only participants receive these rows.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.filter((x) => !(x.pending && x.sender_id === m.sender_id && x.body === m.body)), m]));
        if (m.sender_id !== viewerId) void markConversationReadAction(conversationId);
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    void markConversationReadAction(conversationId);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(body: string, attachment?: { path: string; name: string }) {
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic: ChatMessage = { id: tempId, sender_id: viewerId, body, attachment_path: attachment?.path ?? null, attachment_name: attachment?.name ?? null, created_at: new Date().toISOString(), pending: true };
    setMessages((m) => [...m, optimistic]);
    const res = await sendMessageAction({ conversation_id: conversationId, body, attachment_path: attachment?.path, attachment_name: attachment?.name });
    if (res?.error) {
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, pending: false, failed: true } : x)));
      setError(res.error);
      return;
    }
    const realId = res?.data?.id as string;
    setMessages((m) => (m.some((x) => x.id === realId) ? m.filter((x) => x.id !== tempId) : m.map((x) => (x.id === tempId ? { ...x, id: realId, pending: false } : x))));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    await send(body);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const up = await uploadPrivateFile("message-files", conversationId, file, 10 * 1048576);
    setUploading(false);
    if (up.error) return setError(up.error);
    await send("", { path: up.path!, name: file.name.slice(0, 200) });
  }

  async function openAttachment(path: string, name: string) {
    const { data } = await createClient().storage.from("message-files").createSignedUrl(path, 60, { download: name });
    if (data) window.open(data.signedUrl, "_blank", "noopener");
    else setError("Fichier indisponible.");
  }

  const dayOf = (iso: string) => formatDate(iso, { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col lg:h-[calc(100dvh-10rem)]">
      {!connected && <p className="mb-2 text-center text-[12px] text-warning">Reconnexion au temps réel…</p>}
      <div className="flex-1 space-y-1 overflow-y-auto pb-4 pr-1" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Aucun message. Écris le premier.</p>}
        {messages.map((m, i) => {
          const mine = m.sender_id === viewerId;
          const author = byId.get(m.sender_id);
          const day = dayOf(m.created_at);
          const prev = messages[i - 1];
          const showDay = !prev || dayOf(prev.created_at) !== day;
          const grouped = prev && prev.sender_id === m.sender_id && !showDay;
          return (
            <div key={m.id}>
              {showDay && <p className="my-4 text-center text-[12px] text-subtle">{day}</p>}
              <div className={cn("group flex items-end gap-2", mine && "flex-row-reverse", !grouped && "mt-3")}>
                {!mine && <span className="w-7">{!grouped && <Avatar name={author?.display_name ?? "?"} src={author?.avatar_url} size={28} />}</span>}
                <div className={cn("max-w-[78%]", mine && "items-end")}>
                  {!mine && !grouped && <p className="mb-1 px-1 text-[12px] text-subtle">{author?.display_name ?? "Ancien membre"}</p>}
                  <div className={cn("rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-card border border-border", m.pending && "opacity-60", m.failed && "border border-danger bg-danger-soft text-danger")}>
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachment_path && (
                      <button type="button" onClick={() => openAttachment(m.attachment_path!, m.attachment_name ?? "fichier")} className={cn("mt-1 inline-flex items-center gap-1.5 underline-offset-2 hover:underline", mine ? "text-white" : "text-primary-2")}>
                        <FileText className="size-4" /> {m.attachment_name ?? "Fichier"}
                      </button>
                    )}
                  </div>
                  <div className={cn("mt-0.5 flex items-center gap-2 px-1 text-[11px] text-subtle", mine && "justify-end")}>
                    <span>{m.failed ? "Échec de l'envoi" : new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {!mine && !m.id.startsWith("tmp-") && <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><ReportButton targetType="message" targetId={m.id} iconOnly /></span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <Notice tone="danger" className="mb-2">{error}</Notice>}
      {disabledReason ? (
        <Notice>{disabledReason}</Notice>
      ) : (
        <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
          <label className="cursor-pointer rounded-xl p-2.5 text-muted hover:bg-bg-2 hover:text-fg" aria-label="Joindre un fichier" title="Joindre un fichier (10 Mo max.)">
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
            <input type="file" className="sr-only" disabled={uploading} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement).requestSubmit();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Écrire un message…"
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] placeholder:text-subtle focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} className="rounded-xl bg-primary p-2.5 text-white disabled:opacity-40" aria-label="Envoyer">
            <SendHorizontal className="size-5" />
          </button>
        </form>
      )}
    </div>
  );
}
