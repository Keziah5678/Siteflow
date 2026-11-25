import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Current user + profile, deduplicated per request. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase } as const;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, profile, supabase } as const;
});

export async function requireViewer(next = "/") {
  const v = await getViewer();
  if (!v.user || !v.profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user: v.user, profile: v.profile, supabase: v.supabase };
}

/** Requires a completed profile (onboarding) for participation features. */
export async function requireOnboarded(next = "/") {
  const v = await requireViewer(next);
  if (!v.profile.onboarded) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return v;
}
