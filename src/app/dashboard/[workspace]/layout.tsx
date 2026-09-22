import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Settings, Sprout } from "lucide-react";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NavLink } from "@/components/dashboard/nav-link";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { initials } from "@/lib/utils";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceRoleClient();
  const { data: workspace } = await db
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .maybeSingle();

  if (!workspace) notFound();

  const { data: memberships } = await db
    .from("workspace_members")
    .select("workspace:workspaces(slug, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const options = (memberships ?? [])
    .map((m) => m.workspace as unknown as { slug: string; name: string } | null)
    .filter((w): w is { slug: string; name: string } => Boolean(w));

  const isMember = options.some((w) => w.slug === workspaceSlug);
  if (!isMember) notFound();

  const displayName = user.user_metadata?.full_name || user.email || "Vous";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-medium">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
              <Sprout className="h-3.5 w-3.5" />
            </span>
            Seedflow
          </Link>
        </div>
        <div className="px-3 pb-3">
          <WorkspaceSwitcher current={workspace} options={options} />
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          <NavLink href={`/dashboard/${workspace.slug}`} icon={LayoutGrid} exact>
            Projets
          </NavLink>
          <NavLink href={`/dashboard/${workspace.slug}/settings`} icon={Settings}>
            Paramètres
          </NavLink>
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {initials(displayName)}
            </span>
            <span className="truncate text-sm text-foreground">{displayName}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
