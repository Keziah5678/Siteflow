import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isProjectMember } from "@/lib/supabase/authorize";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!(await isProjectMember(user.id, projectId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const db = createServiceRoleClient();
  const { data: website } = await db.from("websites").select("id").eq("project_id", projectId).maybeSingle();
  if (!website) return NextResponse.json({ versions: [] });

  const { data: versions } = await db
    .from("site_versions")
    .select("id, label, created_at, created_by")
    .eq("website_id", website.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ versions: versions ?? [] });
}
