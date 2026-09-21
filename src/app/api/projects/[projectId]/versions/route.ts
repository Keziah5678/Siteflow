import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: website } = await supabase.from("websites").select("id").eq("project_id", projectId).maybeSingle();
  if (!website) return NextResponse.json({ versions: [] });

  const { data: versions } = await supabase
    .from("site_versions")
    .select("id, label, created_at, created_by")
    .eq("website_id", website.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ versions: versions ?? [] });
}
