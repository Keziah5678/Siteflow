import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, MessageCircle, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { Page, PageHeader } from "@/components/layout/page";
import { Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { LinkTabs } from "@/components/ui/tabs";
import { ContactRequests, NewGroupButton, type RequestRow } from "@/components/messages/requests";

export const metadata: Metadata = { title: "Messages" };

type ConvRow = {
  id: string;
  kind: "direct" | "group" | "project";
  title: string | null;
  project_id: string | null;
  last_message_at: string;
  conversation_participants: { user_id: string; last_read_at: string; profile: { display_name: string; avatar_url: string | null } | null }[];
};

export default async function MessagesPage(props: PageProps<"/messages">) {
  const sp = await props.searchParams;
  const tab = sp.tab === "requests" ? "requests" : "conversations";
  const { user, supabase } = await requireViewer("/messages");

  const [{ data: convs }, { data: requests }, { data: contacts }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, kind, title, project_id, last_message_at, conversation_participants(user_id, last_read_at, profile:profiles(display_name, avatar_url))")
      .order("last_message_at", { ascending: false })
      .limit(60),
    supabase
      .from("contact_requests")
      .select("id, message, created_at, status, from_id, to_id, from:profiles!contact_requests_from_id_fkey(username, display_name, avatar_url), to:profiles!contact_requests_to_id_fkey(username, display_name, avatar_url)")
      .eq("status", "pending")
      .or(`to_id.eq.${user.id},from_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    // Possible group members: people from direct conversations & teams.
    supabase.from("conversation_participants").select("user_id, profile:profiles(display_name)").neq("user_id", user.id).limit(300),
  ]);

  const list = (convs ?? []) as unknown as ConvRow[];
  const ids = list.map((c) => c.id);
  const { data: lastMsgs } = ids.length
    ? await supabase.from("messages").select("conversation_id, body, attachment_name, sender_id, created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(300)
    : { data: [] };
  const last = new Map<string, { body: string; attachment_name: string | null; sender_id: string; created_at: string }>();
  for (const m of lastMsgs ?? []) if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);

  const incoming = ((requests ?? []) as unknown as RequestRow[]).filter((r) => r.to_id === user.id);
  const outgoing = ((requests ?? []) as unknown as RequestRow[]).filter((r) => r.from_id === user.id);
  const contactMap = new Map<string, string>();
  for (const c of contacts ?? []) {
    const name = (c.profile as { display_name: string } | null)?.display_name;
    if (name) contactMap.set(c.user_id, name);
  }

  return (
    <Page>
      <PageHeader title="Messages" action={<NewGroupButton contacts={[...contactMap].map(([id, name]) => ({ id, name }))} />} />
      <LinkTabs
        active={tab}
        className="mb-5"
        tabs={[
          { key: "conversations", label: "Conversations", href: "/messages" },
          { key: "requests", label: "Demandes de contact", href: "/messages?tab=requests", count: incoming.length },
        ]}
      />
      {tab === "requests" ? (
        <ContactRequests incoming={incoming} outgoing={outgoing} />
      ) : list.length === 0 ? (
        <EmptyState icon={<MessageCircle />} title="Aucune conversation" description="Rejoins un projet pour accéder à sa discussion d'équipe, ou envoie une demande de contact depuis un profil." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((c) => {
            const others = c.conversation_participants.filter((p) => p.user_id !== user.id);
            const mine = c.conversation_participants.find((p) => p.user_id === user.id);
            const lm = last.get(c.id);
            const unread = lm && mine && lm.sender_id !== user.id && lm.created_at > mine.last_read_at;
            const name = c.kind === "direct" ? (others[0]?.profile?.display_name ?? "Conversation") : (c.title ?? "Groupe");
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-card-hover">
                  {c.kind === "direct" ? (
                    <Avatar name={name} src={others[0]?.profile?.avatar_url} size={44} />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-2">
                      {c.kind === "project" ? <FolderKanban className="size-5" /> : <Users className="size-5" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>{name}</span>
                      {c.kind === "project" && <Badge tone="neutral">Projet</Badge>}
                      {c.kind === "group" && <Badge tone="neutral">Groupe</Badge>}
                      <span className="ml-auto shrink-0 text-[12px] text-subtle">{lm ? timeAgo(lm.created_at) : ""}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-[13px] ${unread ? "text-fg" : "text-muted"}`}>
                      {lm ? `${lm.sender_id === user.id ? "Toi : " : ""}${lm.body || (lm.attachment_name ? `Pièce jointe : ${lm.attachment_name}` : "")}` : "Aucun message"}
                    </span>
                  </span>
                  {unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Non lu" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
