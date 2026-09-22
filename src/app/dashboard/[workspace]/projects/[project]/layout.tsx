import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  UserSquare2,
  Globe,
  Palette,
  Users,
  ClipboardList,
  MessageCircleQuestion,
  Search,
  ShieldCheck,
  History,
  Workflow,
} from "lucide-react";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isWorkspaceMember } from "@/lib/supabase/authorize";
import { NavLink } from "@/components/dashboard/nav-link";
import { Badge } from "@/components/ui/badge";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Brouillon",
  generating: "Génération…",
  active: "Actif",
  archived: "Archivé",
};

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; project: string }>;
}) {
  const { workspace: workspaceSlug, project: projectSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceRoleClient();

  const { data: workspace } = await db
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (!workspace) notFound();
  if (!(await isWorkspaceMember(user.id, workspace.id))) notFound();

  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("slug", projectSlug)
    .maybeSingle<Project>();
  if (!project) notFound();

  const base = `/dashboard/${workspaceSlug}/projects/${projectSlug}`;

  const navItems = [
    { href: base, icon: LayoutDashboard, label: "Aperçu", exact: true },
    { href: `${base}/profile`, icon: UserSquare2, label: "Profil business" },
    { href: `${base}/site`, icon: Globe, label: "Site & pages" },
    { href: `${base}/design`, icon: Palette, label: "Design" },
    { href: `${base}/leads`, icon: Users, label: "Prospects (CRM)" },
    { href: `${base}/forms`, icon: ClipboardList, label: "Formulaires" },
    { href: `${base}/assistant`, icon: MessageCircleQuestion, label: "Assistant IA" },
    { href: `${base}/seo`, icon: Search, label: "SEO" },
    { href: `${base}/audit`, icon: ShieldCheck, label: "Audit" },
    { href: `${base}/versions`, icon: History, label: "Versions" },
    { href: `${base}/automations`, icon: Workflow, label: "Automatisations" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="space-y-1 border-b border-border p-4">
          <Link
            href={`/dashboard/${workspaceSlug}`}
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Tous les projets
          </Link>
          <h2 className="truncate font-display text-base font-medium">{project.name}</h2>
          <Badge tone={project.status === "active" ? "success" : "neutral"}>
            {STATUS_LABEL[project.status]}
          </Badge>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} exact={item.exact}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
