"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/workspaces";

async function getWorkspaceBySlug(workspaceSlug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("id, slug")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  return data;
}

export async function createProject(
  workspaceSlug: string,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Le nom du projet est requis." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) return { error: "Espace de travail introuvable." };

  const baseSlug = slugify(name) || "projet";
  let slug = baseSlug;
  let attempt = 0;
  let projectId: string | null = null;

  while (attempt < 5 && !projectId) {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspace.id,
        name,
        slug,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!error && data) {
      projectId = data.id;
      break;
    }
    if (error && error.code === "23505") {
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
      continue;
    }
    return { error: error?.message ?? "Impossible de créer le projet." };
  }

  if (!projectId) return { error: "Impossible de créer le projet." };

  // Seed the project's companion rows so every downstream page can rely on
  // them existing (upserted, never overwritten with fake content later).
  await Promise.all([
    supabase.from("business_profiles").insert({ project_id: projectId, company: name }),
    supabase.from("design_systems").insert({ project_id: projectId }),
    supabase.from("websites").insert({ project_id: projectId }),
  ]);

  redirect(`/dashboard/${workspaceSlug}/projects/${slug}`);
}

export async function deleteProject(workspaceSlug: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/${workspaceSlug}`);
  return {};
}

export async function renameProject(
  workspaceSlug: string,
  projectId: string,
  name: string,
): Promise<ActionResult> {
  if (!name.trim()) return { error: "Le nom ne peut pas être vide." };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ name }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/${workspaceSlug}`);
  return {};
}
