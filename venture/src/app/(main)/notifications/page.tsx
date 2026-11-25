import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { Page, PageHeader } from "@/components/layout/page";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { MarkAllRead } from "@/components/settings/mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user, supabase } = await requireViewer("/notifications");
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at, actor:profiles!notifications_actor_id_fkey(display_name, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <Page>
      <PageHeader title="Notifications" description={unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"} action={unread > 0 ? <MarkAllRead /> : undefined} />
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="Aucune notification" description="Tu seras notifié des candidatures, des nouveaux membres, des messages et des avancées de tes projets." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((n) => {
            const actor = n.actor as { display_name: string; avatar_url: string | null } | null;
            const content = (
              <div className="flex gap-3 p-4">
                {actor ? <Avatar name={actor.display_name} src={actor.avatar_url} size={36} /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-2"><Bell className="size-4" /></span>}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read_at ? "" : "font-semibold"}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{n.body}</p>}
                  <p className="mt-1 text-[12px] text-subtle">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-card-hover">{content}</Link> : content}</li>;
          })}
        </ul>
      )}
    </Page>
  );
}
