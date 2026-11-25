import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { Page, PageHeader } from "@/components/layout/page";
import { ProjectEditor } from "@/components/project/project-editor";
import { DeleteProjectButton } from "@/components/project/delete-project";

export const metadata: Metadata = { title: "Modifier le projet" };

export default async function EditProjectPage(props: PageProps<"/projects/[id]/edit">) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user, supabase } = await requireViewer(`/projects/${id}/edit`);
  const [{ data: p }, { data: me }, { data: ev }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("event_details").select("*").eq("project_id", id).maybeSingle(),
  ]);
  if (!p) notFound();
  if (!me || (me.role !== "owner" && me.role !== "admin")) redirect(`/projects/${id}`);
  return (
    <Page>
      <PageHeader title="Modifier le projet" description={p.title} />
      <ProjectEditor
        userId={user.id}
        projectId={id}
        initial={{
          title: p.title,
          description: p.description,
          category: p.category,
          status: p.status,
          goal: p.goal ?? "",
          interest_goal: p.interest_goal,
          skills_needed: p.skills_needed,
          resources_needed: p.resources_needed,
          first_steps: [],
          budget_estimate_eur: p.budget_estimate_cents != null ? p.budget_estimate_cents / 100 : null,
          city: p.city ?? "",
          is_remote: p.is_remote,
          cover_url: p.cover_url,
          venue_idea: ev?.venue_idea ?? "",
          capacity: ev?.capacity ?? null,
          price_min_eur: ev?.price_min_cents != null ? ev.price_min_cents / 100 : null,
          price_max_eur: ev?.price_max_cents != null ? ev.price_max_cents / 100 : null,
          date_options: ev?.date_options ?? [],
        }}
      />
      {me.role === "owner" && (
        <div className="mt-12 rounded-2xl border border-danger/30 p-5">
          <p className="text-sm font-medium">Supprimer le projet</p>
          <p className="mt-1 text-[13px] text-muted">Supprime définitivement le projet, ses étapes, tâches, documents et sa discussion d'équipe. Action irréversible.</p>
          <DeleteProjectButton projectId={id} title={p.title} />
        </div>
      )}
    </Page>
  );
}
