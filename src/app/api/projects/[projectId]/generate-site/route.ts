import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isProjectMember } from "@/lib/supabase/authorize";
import { orchestrator } from "@/lib/ai/orchestrator";
import { isAIConfigured, AIUnavailableError } from "@/lib/ai/client";
import { enrichImages } from "@/lib/ai/enrich-images";
import { slugify } from "@/lib/utils";
import type { BusinessProfile } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  if (!isAIConfigured()) {
    return NextResponse.json(
      { error: new AIUnavailableError().message },
      { status: 503 },
    );
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

  const { data: profile, error: profileError } = await db
    .from("business_profiles")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle<BusinessProfile>();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if (!profile) return NextResponse.json({ error: "Profil business introuvable." }, { status: 404 });
  if (!profile.company || !profile.industry) {
    return NextResponse.json(
      { error: "Complétez au moins le nom et le secteur d'activité avant de générer le site." },
      { status: 422 },
    );
  }

  const { data: website, error: websiteError } = await db
    .from("websites")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (websiteError) return NextResponse.json({ error: websiteError.message }, { status: 400 });
  if (!website) return NextResponse.json({ error: "Site introuvable pour ce projet." }, { status: 404 });

  await db.from("projects").update({ status: "generating" }).eq("id", projectId);

  try {
    const { plan } = await orchestrator.generateWebsite(profile);
    const pagesWithImages = await enrichImages(plan.pages, orchestrator.images);

    // Design system: update the placeholder row created at project creation.
    const { error: designError } = await db
      .from("design_systems")
      .update({
        colors: plan.design_system.colors,
        typography: plan.design_system.typography,
        spacing_scale: plan.design_system.spacing_scale,
        radii: plan.design_system.radii,
        shadows: plan.design_system.shadows,
        button_style: plan.design_system.button_style,
        animation_intensity: plan.design_system.animation_intensity,
      })
      .eq("project_id", projectId);
    if (designError) throw new Error(designError.message);

    let publicSlug = website.public_slug;
    if (!publicSlug) {
      const base = slugify(profile.company) || "site";
      for (let attempt = 0; attempt < 6 && !publicSlug; attempt++) {
        const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
        const { error: slugError } = await db
          .from("websites")
          .update({ public_slug: candidate })
          .eq("id", website.id);
        if (!slugError) publicSlug = candidate;
        else if (slugError.code !== "23505") throw new Error(slugError.message);
      }
    }

    await db
      .from("websites")
      .update({ global_seo: plan.global_seo, status: "published" })
      .eq("id", website.id);

    // Replace any existing pages (regeneration case) — cascades to sections.
    await db.from("pages").delete().eq("website_id", website.id);

    for (let i = 0; i < pagesWithImages.length; i++) {
      const page = pagesWithImages[i];
      const { data: insertedPage, error: pageError } = await db
        .from("pages")
        .insert({
          website_id: website.id,
          slug: page.slug,
          title: page.title,
          is_home: page.is_home,
          nav_order: i,
          status: "published",
          seo: page.seo ?? {},
        })
        .select("id")
        .single();
      if (pageError) throw new Error(pageError.message);

      const sectionRows = page.sections.map((section, position) => ({
        page_id: insertedPage.id,
        type: section.type,
        position,
        content: section.content,
      }));
      if (sectionRows.length > 0) {
        const { error: sectionsError } = await db.from("sections").insert(sectionRows);
        if (sectionsError) throw new Error(sectionsError.message);
      }
    }

    // Forms — best-effort, generation succeeding matters more than forms.
    try {
      const formsPlan = await orchestrator.forms.generate(profile);
      await db.from("forms").delete().eq("project_id", projectId);
      if (formsPlan.forms.length > 0) {
        await db.from("forms").insert(
          formsPlan.forms.map((f) => ({
            project_id: projectId,
            name: f.name,
            type: f.type,
            fields: f.fields,
          })),
        );
      }
    } catch {
      // Non-blocking: the site is still usable without pre-generated forms.
    }

    // Snapshot the freshly generated site as the first version.
    const { data: fullPages } = await db
      .from("pages")
      .select("*, sections(*)")
      .eq("website_id", website.id)
      .order("nav_order");
    const { data: designSystem } = await db
      .from("design_systems")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    const { data: refreshedWebsite } = await db
      .from("websites")
      .select("*")
      .eq("id", website.id)
      .single();

    await db.from("site_versions").insert({
      website_id: website.id,
      label: "Génération initiale",
      snapshot: { website: refreshedWebsite, pages: fullPages, design_system: designSystem },
      created_by: user.id,
    });

    await db.from("projects").update({ status: "active" }).eq("id", projectId);

    return NextResponse.json({ success: true, websiteId: website.id });
  } catch (err) {
    await db.from("projects").update({ status: "draft" }).eq("id", projectId);
    const message = err instanceof Error ? err.message : "La génération du site a échoué.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
