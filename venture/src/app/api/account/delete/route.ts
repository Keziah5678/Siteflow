import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/** Account deletion (RGPD art. 17). Cascades remove all user-owned rows. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.confirm !== "SUPPRIMER MON COMPTE") return NextResponse.json({ error: "Confirmation invalide." }, { status: 400 });

  const admin = createServiceClient();
  const { data: profile } = await admin.from("profiles").select("platform_role").eq("id", user.id).single();
  if (profile?.platform_role === "superadmin") return NextResponse.json({ error: "Un super-administrateur doit d'abord transférer son rôle." }, { status: 409 });

  // Cancel any active subscription first, so the user is not billed again.
  const { data: sub } = await admin.from("subscriptions").select("stripe_subscription_id, status").eq("user_id", user.id).maybeSingle();
  const stripe = getStripe();
  if (stripe && sub?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (e) {
      console.error("[venture] stripe cancel on delete failed", e);
      return NextResponse.json({ error: "Impossible d'annuler ton abonnement. Réessaie ou contacte le support." }, { status: 502 });
    }
  }

  // Files of projects the user owns (the rows are removed by cascade).
  const { data: owned } = await admin.from("projects").select("id").eq("owner_id", user.id);
  for (const p of owned ?? []) {
    const { data: files } = await admin.storage.from("project-files").list(p.id, { limit: 1000 });
    if (files?.length) await admin.storage.from("project-files").remove(files.map((f) => `${p.id}/${f.name}`));
  }
  // Remove the user's files from storage (avatars, covers they uploaded).
  for (const bucket of ["avatars", "covers"] as const) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[venture] delete user failed", error);
    return NextResponse.json({ error: "Suppression impossible pour le moment." }, { status: 500 });
  }
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
