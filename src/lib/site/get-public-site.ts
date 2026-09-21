import { createClient } from "@/lib/supabase/server";
import type { BusinessProfile, DesignSystem, Page, ProjectForm, Section, Website } from "@/lib/types";

export interface PublicSite {
  website: Website;
  pages: (Page & { sections: Section[] })[];
  designSystem: DesignSystem;
  businessProfile: BusinessProfile;
  forms: ProjectForm[];
}

/** Loads a published site for anonymous/public rendering, via RLS public-read policies. */
export async function getPublicSite(publicSlug: string): Promise<PublicSite | null> {
  const supabase = await createClient();

  const { data: website } = await supabase
    .from("websites")
    .select("*")
    .eq("public_slug", publicSlug)
    .eq("status", "published")
    .maybeSingle<Website>();
  if (!website) return null;

  const [{ data: pages }, { data: designSystem }, { data: businessProfile }, { data: forms }] = await Promise.all([
    supabase
      .from("pages")
      .select("*, sections(*)")
      .eq("website_id", website.id)
      .eq("status", "published")
      .order("nav_order"),
    supabase.from("design_systems").select("*").eq("project_id", website.project_id).maybeSingle<DesignSystem>(),
    supabase.from("business_profiles").select("*").eq("project_id", website.project_id).maybeSingle<BusinessProfile>(),
    supabase.from("forms").select("*").eq("project_id", website.project_id),
  ]);

  if (!pages || pages.length === 0 || !designSystem || !businessProfile) return null;

  return {
    website,
    pages: pages.map((p) => ({ ...p, sections: [...(p.sections as Section[])].sort((a, b) => a.position - b.position) })),
    designSystem,
    businessProfile,
    forms: (forms ?? []) as ProjectForm[],
  };
}
