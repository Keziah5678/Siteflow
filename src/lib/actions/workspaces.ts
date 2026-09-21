"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export interface ActionResult {
  error?: string;
}

export async function createWorkspace(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Le nom de l'espace de travail est requis." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const baseSlug = slugify(name) || "workspace";
  let slug = baseSlug;
  let attempt = 0;
  let workspaceId: string | null = null;

  // Try a few slug variants in case of collision (workspaces.slug is unique).
  while (attempt < 5 && !workspaceId) {
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name, slug, owner_id: user.id })
      .select("id")
      .single();

    if (!error && data) {
      workspaceId = data.id;
      break;
    }

    if (error && error.code === "23505") {
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
      continue;
    }

    return { error: error?.message ?? "Impossible de créer l'espace de travail." };
  }

  if (!workspaceId) return { error: "Impossible de créer l'espace de travail." };

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: user.id, role: "owner" });

  if (memberError) return { error: memberError.message };

  redirect(`/dashboard/${slug}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
