import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/ai/orchestrator";
import { getWebsiteSnapshot } from "@/lib/site/get-snapshot";
import type { BusinessProfile } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const snapshot = await getWebsiteSnapshot(supabase, projectId);
  if (!snapshot || snapshot.pages.length === 0) {
    return NextResponse.json({ error: "Générez d'abord votre site avant de lancer un audit." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle<BusinessProfile>();
  if (!profile) return NextResponse.json({ error: "Profil business introuvable." }, { status: 404 });

  const result = await orchestrator.auditor.audit(profile, snapshot.design_system, snapshot.pages);

  const values = Object.values(result.scores);
  const overall = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  const { data: audit, error } = await supabase
    .from("seo_audits")
    .insert({
      project_id: projectId,
      scores: { ...result.scores, overall },
      issues: result.issues,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ audit });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: audits } = await supabase
    .from("seo_audits")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ audit: audits?.[0] ?? null });
}
