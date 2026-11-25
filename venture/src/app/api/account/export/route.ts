import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Personal data export (RGPD art. 15/20): everything the user owns, as JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = user.id;
  const q = <T,>(p: PromiseLike<{ data: T | null }>) => p.then((r) => r.data);
  const [profile, priv, projects, memberships, engagements, applications, comments, messages, tasks, endorsementsGiven, endorsementsReceived, notifications, contactRequests, blocks, reports, aiUsage, subscription] = await Promise.all([
    q(supabase.from("profiles").select("*").eq("id", uid).single()),
    q(supabase.from("profile_private").select("birthdate, lat, lng, email_notifications, created_at").eq("id", uid).single()),
    q(supabase.from("projects").select("*").eq("owner_id", uid)),
    q(supabase.from("project_members").select("*").eq("user_id", uid)),
    q(supabase.from("project_engagements").select("*").eq("user_id", uid)),
    q(supabase.from("applications").select("*").eq("applicant_id", uid)),
    q(supabase.from("comments").select("*").eq("author_id", uid)),
    q(supabase.from("messages").select("*").eq("sender_id", uid)),
    q(supabase.from("tasks").select("*").eq("created_by", uid)),
    q(supabase.from("endorsements").select("*").eq("author_id", uid)),
    q(supabase.from("endorsements").select("*").eq("recipient_id", uid)),
    q(supabase.from("notifications").select("*").eq("user_id", uid)),
    q(supabase.from("contact_requests").select("*").or(`from_id.eq.${uid},to_id.eq.${uid}`)),
    q(supabase.from("blocks").select("*").eq("blocker_id", uid)),
    q(supabase.from("reports").select("*").eq("reporter_id", uid)),
    q(supabase.from("ai_usage").select("*").eq("user_id", uid)),
    q(supabase.from("subscriptions").select("*").eq("user_id", uid).maybeSingle()),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: user.email, created_at: user.created_at },
    profile, private: priv, projects, memberships, engagements, applications, comments, messages, tasks,
    endorsements: { given: endorsementsGiven, received: endorsementsReceived },
    notifications, contact_requests: contactRequests, blocks, reports, ai_usage: aiUsage, subscription,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="venture-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
