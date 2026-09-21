import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModificationDiff } from "@/lib/ai/schemas";

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

const DESIGN_SYSTEM_JSON_FIELDS = new Set(["colors", "typography"]);
const DESIGN_SYSTEM_SCALAR_FIELDS = new Set([
  "spacing_scale",
  "radii",
  "shadows",
  "button_style",
  "animation_intensity",
]);

async function renumberSections(supabase: SupabaseClient, pageId: string) {
  const { data: sections } = await supabase
    .from("sections")
    .select("id, position")
    .eq("page_id", pageId)
    .order("position", { ascending: true });
  if (!sections) return;
  await Promise.all(
    sections.map((s, i) => (s.position === i ? null : supabase.from("sections").update({ position: i }).eq("id", s.id))),
  );
}

/**
 * Applies a validated ModificationDiff (produced by ModificationAgent)
 * directly against the database. Each operation is looked up by the
 * stable identifiers (page slug, section index at diff time) the agent was
 * given in its snapshot — this function trusts the diff's shape (already
 * Zod-validated) but re-resolves current DB state for every operation.
 */
export async function applyModificationDiff(
  supabase: SupabaseClient,
  websiteId: string,
  projectId: string,
  diff: ModificationDiff,
) {
  for (const op of diff.operations) {
    switch (op.op) {
      case "update_design_system": {
        const { data: current } = await supabase
          .from("design_systems")
          .select("*")
          .eq("project_id", projectId)
          .single();
        if (!current) break;

        const update: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(op.patch)) {
          if (DESIGN_SYSTEM_JSON_FIELDS.has(key) && value && typeof value === "object") {
            update[key] = deepMerge(current[key] ?? {}, value as Record<string, unknown>);
          } else if (DESIGN_SYSTEM_SCALAR_FIELDS.has(key)) {
            update[key] = value;
          }
        }
        if (Object.keys(update).length > 0) {
          await supabase.from("design_systems").update(update).eq("project_id", projectId);
        }
        break;
      }

      case "update_section": {
        const { data: page } = await supabase
          .from("pages")
          .select("id")
          .eq("website_id", websiteId)
          .eq("slug", op.page_slug)
          .maybeSingle();
        if (!page) break;
        const { data: sections } = await supabase
          .from("sections")
          .select("id, content")
          .eq("page_id", page.id)
          .order("position", { ascending: true });
        const target = sections?.[op.section_index];
        if (!target) break;
        const mergedContent = deepMerge(target.content ?? {}, op.patch);
        await supabase.from("sections").update({ content: mergedContent }).eq("id", target.id);
        break;
      }

      case "add_section": {
        const { data: page } = await supabase
          .from("pages")
          .select("id")
          .eq("website_id", websiteId)
          .eq("slug", op.page_slug)
          .maybeSingle();
        if (!page) break;
        await supabase.from("sections").insert({
          page_id: page.id,
          type: op.section.type,
          position: op.position,
          content: op.section.content,
        });
        await renumberSections(supabase, page.id);
        break;
      }

      case "remove_section": {
        const { data: page } = await supabase
          .from("pages")
          .select("id")
          .eq("website_id", websiteId)
          .eq("slug", op.page_slug)
          .maybeSingle();
        if (!page) break;
        const { data: sections } = await supabase
          .from("sections")
          .select("id")
          .eq("page_id", page.id)
          .order("position", { ascending: true });
        const target = sections?.[op.section_index];
        if (!target) break;
        await supabase.from("sections").delete().eq("id", target.id);
        await renumberSections(supabase, page.id);
        break;
      }

      case "add_page": {
        const { count } = await supabase
          .from("pages")
          .select("id", { count: "exact", head: true })
          .eq("website_id", websiteId);
        const { data: insertedPage } = await supabase
          .from("pages")
          .insert({
            website_id: websiteId,
            slug: op.page.slug,
            title: op.page.title,
            is_home: op.page.is_home,
            nav_order: count ?? 0,
            status: "published",
            seo: op.page.seo ?? {},
          })
          .select("id")
          .single();
        if (!insertedPage) break;
        const rows = op.page.sections.map((s, i) => ({
          page_id: insertedPage.id,
          type: s.type,
          position: i,
          content: s.content,
        }));
        if (rows.length > 0) await supabase.from("sections").insert(rows);
        break;
      }

      case "remove_page": {
        await supabase.from("pages").delete().eq("website_id", websiteId).eq("slug", op.page_slug);
        break;
      }
    }
  }
}
