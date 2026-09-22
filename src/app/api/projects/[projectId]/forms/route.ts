import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isProjectMember } from "@/lib/supabase/authorize";
import { orchestrator } from "@/lib/ai/orchestrator";
import { isAIConfigured, AIUnavailableError } from "@/lib/ai/client";
import type { BusinessProfile } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  if (!isAIConfigured()) {
    return NextResponse.json({ error: new AIUnavailableError().message }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!(await isProjectMember(user.id, projectId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const db = createServiceRoleClient();
  const { data: profile } = await db
    .from("business_profiles")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle<BusinessProfile>();
  if (!profile) return NextResponse.json({ error: "Profil business introuvable." }, { status: 404 });

  try {
    const plan = await orchestrator.forms.generate(profile);
    await db.from("forms").delete().eq("project_id", projectId);
    const { data: inserted, error } = await db
      .from("forms")
      .insert(plan.forms.map((f) => ({ project_id: projectId, name: f.name, type: f.type, fields: f.fields })))
      .select("*");
    if (error) throw new Error(error.message);
    return NextResponse.json({ forms: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "La génération des formulaires a échoué.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
