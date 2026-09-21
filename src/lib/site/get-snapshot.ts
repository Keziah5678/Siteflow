import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebsiteSnapshot } from "@/lib/types";

/** Builds a full WebsiteSnapshot (website + ordered pages/sections + design system) from the DB. */
export async function getWebsiteSnapshot(
  supabase: SupabaseClient,
  projectId: string,
): Promise<WebsiteSnapshot | null> {
  const { data: website } = await supabase.from("websites").select("*").eq("project_id", projectId).maybeSingle();
  if (!website) return null;

  const { data: pages } = await supabase
    .from("pages")
    .select("*, sections(*)")
    .eq("website_id", website.id)
    .order("nav_order", { ascending: true });

  const { data: designSystem } = await supabase
    .from("design_systems")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const orderedPages = (pages ?? []).map((p) => ({
    ...p,
    sections: [...(p.sections ?? [])].sort((a, b) => a.position - b.position),
  }));

  return {
    website,
    pages: orderedPages,
    design_system: designSystem ?? null,
  } as WebsiteSnapshot;
}
