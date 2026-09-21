import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle<BusinessProfile>();
  if (!profile) return NextResponse.json({ error: "Profil business introuvable." }, { status: 404 });

  try {
    const plan = await orchestrator.forms.generate(profile);
    await supabase.from("forms").delete().eq("project_id", projectId);
    const { data: inserted, error } = await supabase
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
