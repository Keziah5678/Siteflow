import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type DB = SupabaseClient<Database>;

export const PROJECT_CARD_SELECT =
  "id, title, description, category, status, goal, interest_goal, interest_count, participant_count, member_count, milestones_done, milestones_total, skills_needed, city, is_remote, cover_url, is_demo, sponsor_id, created_at, owner:profiles!projects_owner_id_fkey(id, username, display_name, avatar_url), event_details(stage, venue_idea, price_min_cents, price_max_cents, date_options)";

export type ProjectCardData = {
  id: string;
  title: string;
  description: string;
  category: Database["public"]["Enums"]["project_category"];
  status: Database["public"]["Enums"]["project_status"];
  goal: string | null;
  interest_goal: number | null;
  interest_count: number;
  participant_count: number;
  member_count: number;
  milestones_done: number;
  milestones_total: number;
  skills_needed: string[];
  city: string | null;
  is_remote: boolean;
  cover_url: string | null;
  is_demo: boolean;
  sponsor_id: string | null;
  created_at: string;
  owner: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  event_details: { stage: Database["public"]["Enums"]["event_stage"]; venue_idea: string | null; price_min_cents: number | null; price_max_cents: number | null; date_options: string[] } | null;
};

export const getAppSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    showDemo: map.get("show_demo_content") !== false,
    ticketingCommission: Number(map.get("ticketing_commission_pct") ?? 5),
    servicesCommission: Number(map.get("services_commission_pct") ?? 8),
    regulatedFunding: map.get("regulated_funding_enabled") === true,
  };
});

/** The viewer's own engagements on a set of projects, for button states. */
export async function getEngagementState(db: DB, userId: string | null, projectIds: string[]) {
  const res = new Map<string, { interested: boolean; participating: boolean; applied: boolean; member: boolean }>();
  for (const id of projectIds) res.set(id, { interested: false, participating: false, applied: false, member: false });
  if (!userId || projectIds.length === 0) return res;
  const [{ data: eng }, { data: apps }, { data: mem }] = await Promise.all([
    db.from("project_engagements").select("project_id, kind").eq("user_id", userId).in("project_id", projectIds),
    db.from("applications").select("project_id").eq("applicant_id", userId).eq("status", "pending").in("project_id", projectIds),
    db.from("project_members").select("project_id").eq("user_id", userId).in("project_id", projectIds),
  ]);
  for (const e of eng ?? []) {
    const s = res.get(e.project_id)!;
    if (e.kind === "interested") s.interested = true;
    else s.participating = true;
  }
  for (const a of apps ?? []) res.get(a.project_id)!.applied = true;
  for (const m of mem ?? []) res.get(m.project_id)!.member = true;
  return res;
}
