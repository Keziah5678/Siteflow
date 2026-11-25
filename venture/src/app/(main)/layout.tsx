import { getViewer } from "@/lib/auth";
import { Sidebar, MobileTabBar, MobileTopBar } from "@/components/layout/nav";
import { LiveCountsProvider } from "@/components/layout/live-counts";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, supabase } = await getViewer();
  let counts = { notifications: 0, messages: 0 };
  if (user) {
    const [{ count: n }, { count: m }] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "message").is("read_at", null),
    ]);
    counts = { notifications: n ?? 0, messages: m ?? 0 };
  }
  const viewer = profile
    ? { display_name: profile.display_name, username: profile.username, avatar_url: profile.avatar_url, is_staff: profile.platform_role !== "user", is_business: profile.account_type === "business" }
    : null;
  return (
    <LiveCountsProvider userId={user?.id ?? null} initial={counts}>
      <div className="mx-auto flex min-h-dvh max-w-[1320px]">
        <Sidebar viewer={viewer} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar signedIn={!!user} />
          <div className="flex-1 pb-24 lg:pb-0">{children}</div>
        </div>
      </div>
      <MobileTabBar username={profile?.username ?? null} />
    </LiveCountsProvider>
  );
}
