import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWebsiteSnapshot } from "@/lib/site/get-snapshot";
import type { WebsiteSnapshot } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; versionId: string }> },
) {
  const { projectId, versionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: website } = await supabase.from("websites").select("id").eq("project_id", projectId).maybeSingle();
  if (!website) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .select("*")
    .eq("id", versionId)
    .eq("website_id", website.id)
    .maybeSingle();
  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 400 });
  if (!version) return NextResponse.json({ error: "Version introuvable." }, { status: 404 });

  const snapshot = version.snapshot as WebsiteSnapshot;

  if (snapshot.design_system) {
    const { id, project_id, created_at, updated_at, ...designFields } = snapshot.design_system;
    void id;
    void project_id;
    void created_at;
    void updated_at;
    await supabase.from("design_systems").update(designFields).eq("project_id", projectId);
  }

  await supabase.from("websites").update({ global_seo: snapshot.website?.global_seo ?? {} }).eq("id", website.id);

  await supabase.from("pages").delete().eq("website_id", website.id);

  for (const page of snapshot.pages ?? []) {
    const { data: insertedPage, error: pageError } = await supabase
      .from("pages")
      .insert({
        website_id: website.id,
        slug: page.slug,
        title: page.title,
        is_home: page.is_home,
        nav_order: page.nav_order,
        status: page.status,
        seo: page.seo ?? {},
      })
      .select("id")
      .single();
    if (pageError) return NextResponse.json({ error: pageError.message }, { status: 400 });

    const sectionRows = (page.sections ?? []).map((s, i) => ({
      page_id: insertedPage.id,
      type: s.type,
      position: i,
      content: s.content,
    }));
    if (sectionRows.length > 0) {
      const { error: sectionsError } = await supabase.from("sections").insert(sectionRows);
      if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 400 });
    }
  }

  const restoredSnapshot = await getWebsiteSnapshot(supabase, projectId);
  await supabase.from("site_versions").insert({
    website_id: website.id,
    label: `Restauration : ${version.label}`,
    snapshot: restoredSnapshot,
    created_by: user.id,
  });

  return NextResponse.json({ success: true });
}
