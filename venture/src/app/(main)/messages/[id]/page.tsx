import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban, Users } from "lucide-react";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { Page } from "@/components/layout/page";
import { Avatar } from "@/components/ui/primitives";
import { Chat, type ChatMessage, type ChatPerson } from "@/components/messages/chat";
import { BlockButton } from "@/components/profile/block-button";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage(props: PageProps<"/messages/[id]">) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user, supabase } = await requireViewer(`/messages/${id}`);

  // RLS: returns nothing unless the viewer is a participant.
  const { data: conv } = await supabase.from("conversations").select("id, kind, title, project_id").eq("id", id).maybeSingle();
  if (!conv) notFound();

  const [{ data: parts }, { data: msgs }] = await Promise.all([
    supabase.from("conversation_participants").select("user_id, profile:profiles(id, username, display_name, avatar_url)").eq("conversation_id", id),
    supabase.from("messages").select("id, sender_id, body, attachment_path, attachment_name, created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(150),
  ]);
  const people = (parts ?? []).map((p) => p.profile as unknown as ChatPerson & { username: string }).filter(Boolean);
  // Senders who left the conversation still need a name.
  const missing = [...new Set((msgs ?? []).map((m) => m.sender_id))].filter((sid) => !people.some((p) => p.id === sid));
  if (missing.length) {
    const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", missing);
    people.push(...((data ?? []) as (ChatPerson & { username: string })[]));
  }
  const other = conv.kind === "direct" ? people.find((p) => p.id !== user.id) : null;

  let disabledReason: string | null = null;
  if (other) {
    const { data: blocked } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", other.id).maybeSingle();
    if (blocked) disabledReason = "Tu as bloqué cette personne. Débloque-la pour lui écrire à nouveau.";
  }

  return (
    <Page>
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <Link href="/messages" className="rounded-lg p-1.5 text-muted hover:bg-card hover:text-fg" aria-label="Retour aux messages"><ArrowLeft className="size-5" /></Link>
        {other ? (
          <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar name={other.display_name} src={other.avatar_url} size={36} />
            <span className="truncate font-medium">{other.display_name}</span>
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary-2">{conv.kind === "project" ? <FolderKanban className="size-4" /> : <Users className="size-4" />}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{conv.title ?? "Groupe"}</span>
              <span className="block text-[12px] text-subtle">{people.length} participant{people.length > 1 ? "s" : ""}</span>
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {conv.project_id && <Link href={`/projects/${conv.project_id}/space`} className="text-[13px] text-primary-2 hover:underline">Espace projet</Link>}
          {other && <BlockButton userId={other.id} blocked={!!disabledReason} />}
        </div>
      </div>
      <Chat conversationId={id} viewerId={user.id} initial={((msgs ?? []) as ChatMessage[]).reverse()} people={people} disabledReason={disabledReason} />
    </Page>
  );
}
