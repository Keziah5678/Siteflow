"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import { findCity } from "@/lib/cities";
import { fieldErrors, messageSchema, opportunitySchema, privacySchema, profileSchema, reportSchema } from "@/lib/validation";
import { safeRedirectPath } from "@/lib/utils";
import type { ActionState } from "./types";

const uuid = z.string().uuid();

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function saveProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const { supabase, user } = await authed();
  if (!user) return { error: "Session expirée." };
  const city = findCity(parsed.data.city);
  const isOnboarding = formData.get("onboarding") === "1";
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, city: city?.name ?? parsed.data.city, ...(isOnboarding ? { onboarded: true } : {}) })
    .eq("id", user.id);
  if (error) return { error: error.code === "23505" ? "Ce nom d'utilisateur est déjà pris." : toUserMessage(error), fields: error.code === "23505" ? { username: "Déjà pris" } : undefined };

  // Approximate location for "À proximité" and matching (city centre, ~1 km rounding in DB).
  const shareLocation = formData.get("share_location") === "on" || formData.get("share_location") === "true";
  if (isOnboarding || formData.has("share_location_present")) {
    await supabase
      .from("profile_private")
      .update(shareLocation && city ? { lat: city.lat, lng: city.lng } : { lat: null, lng: null })
      .eq("id", user.id);
  }
  revalidatePath("/", "layout");
  if (isOnboarding) redirect(safeRedirectPath(formData.get("next")?.toString(), "/"));
  return { ok: true, message: "Profil enregistré." };
}

export async function savePrivacyAction(input: z.input<typeof privacySchema>): Promise<ActionState> {
  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) return { error: "Paramètres invalides." };
  const { supabase, user } = await authed();
  if (!user) return { error: "Session expirée." };
  const { share_location, email_notifications, ...pub } = parsed.data;
  const { data: prof } = await supabase.from("profiles").select("city").eq("id", user.id).single();
  const city = findCity(prof?.city);
  const [a, b] = await Promise.all([
    supabase.from("profiles").update(pub).eq("id", user.id),
    supabase
      .from("profile_private")
      .update({ email_notifications, ...(share_location && city ? { lat: city.lat, lng: city.lng } : { lat: null, lng: null }) })
      .eq("id", user.id),
  ]);
  if (a.error || b.error) return { error: toUserMessage(a.error ?? b.error) };
  revalidatePath("/settings");
  return { ok: true, message: share_location && !city ? "Enregistré. Choisis une ville reconnue dans ton profil pour activer « À proximité »." : "Paramètres enregistrés." };
}

export async function setAvatarAction(url: string | null): Promise<ActionState> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Session expirée." };
  if (url && !url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`)) return { error: "Image invalide." };
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function becomeBusinessAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ company: z.string().trim().min(2).max(80), website: z.string().trim().max(300).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Nom d'entreprise invalide (2 à 80 caractères)." };
  const { supabase } = await authed();
  const website = parsed.data.website ? parsed.data.website : null;
  const { error } = await supabase.rpc("become_business", { p_company: parsed.data.company, p_website: website ?? undefined });
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Compte professionnel activé." };
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------
export async function sendMessageAction(input: { conversation_id: string; body: string; attachment_path?: string | null; attachment_name?: string | null }): Promise<ActionState> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { error: "Message invalide." };
  const body = parsed.data.body.trim();
  if (!body && !input.attachment_path) return { error: "Message vide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "Session expirée." };
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversation_id,
      sender_id: user.id,
      body,
      attachment_path: input.attachment_path ?? null,
      attachment_name: input.attachment_name?.slice(0, 200) ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) return { error: toUserMessage(error) };
  return { ok: true, data: { id: data.id, created_at: data.created_at } };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  if (!uuid.safeParse(conversationId).success) return;
  const { supabase, user } = await authed();
  if (!user) return;
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).eq("link", `/messages/${conversationId}`).is("read_at", null);
}

/** Opens (or creates) a direct conversation; falls back to a contact request. */
export async function startConversationAction(otherId: string): Promise<ActionState> {
  if (!uuid.safeParse(otherId).success) return { error: "Requête invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { p_other: otherId });
  if (error) {
    if (error.message.includes("VENTURE_CONTACT_REQUIRED")) return { error: "CONTACT_REQUIRED" };
    return { error: toUserMessage(error) };
  }
  redirect(`/messages/${data}`);
}

export async function sendContactRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ to_id: uuid, message: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Requête invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("contact_requests").insert({ from_id: user.id, to_id: parsed.data.to_id, message: parsed.data.message || null });
  if (error) return { error: error.code === "23505" ? "Une demande est déjà en attente." : toUserMessage(error) };
  return { ok: true, message: "Demande de contact envoyée." };
}

export async function respondContactRequestAction(requestId: string, accept: boolean): Promise<ActionState> {
  const { supabase } = await authed();
  const { data, error } = await supabase.rpc("respond_contact_request", { p_request: requestId, p_accept: accept });
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/messages");
  if (accept && data) redirect(`/messages/${data}`);
  return { ok: true };
}

export async function createGroupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const members = formData.getAll("members").map(String);
  const parsed = z.object({ title: z.string().trim().min(2).max(80), members: z.array(uuid).min(1).max(50) }).safeParse({ title: formData.get("title"), members });
  if (!parsed.success) return { error: "Choisis un nom (2 à 80 caractères) et au moins un membre." };
  const { supabase } = await authed();
  const { data, error } = await supabase.rpc("create_group_conversation", { p_title: parsed.data.title, p_members: parsed.data.members });
  if (error) return { error: toUserMessage(error) };
  redirect(`/messages/${data}`);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function markNotificationsReadAction(ids?: string[]): Promise<ActionState> {
  const { supabase, user } = await authed();
  if (!user) return { error: "Session expirée." };
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids.filter((i) => uuid.safeParse(i).success));
  const { error } = await q;
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Safety: reports & blocks
// ---------------------------------------------------------------------------
export async function reportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choisis un motif." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("reports").insert({ ...parsed.data, reporter_id: user.id });
  if (error) return { error: error.code === "23505" ? "Tu as déjà signalé cet élément, il est en cours d'examen." : toUserMessage(error) };
  return { ok: true, message: "Merci. L'équipe de modération va examiner ce signalement." };
}

export async function blockUserAction(otherId: string, block: boolean): Promise<ActionState> {
  if (!uuid.safeParse(otherId).success) return { error: "Requête invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  if (user.id === otherId) return { error: "Action impossible." };
  const { error } = block
    ? await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: otherId })
    : await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", otherId);
  if (error && error.code !== "23505") return { error: toUserMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: block ? "Utilisateur bloqué." : "Utilisateur débloqué." };
}

// ---------------------------------------------------------------------------
// Endorsements ("Recommandations reçues")
// ---------------------------------------------------------------------------
export async function endorseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ recipient_id: uuid, project_id: uuid, body: z.string().trim().min(10).max(800) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ta recommandation doit contenir entre 10 et 800 caractères." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("endorsements").insert({ ...parsed.data, author_id: user.id });
  if (error) return { error: error.code === "23505" ? "Tu as déjà recommandé cette personne pour ce projet." : toUserMessage(error) };
  revalidatePath("/u/[username]", "page");
  return { ok: true, message: "Recommandation publiée." };
}

// ---------------------------------------------------------------------------
// Opportunities (business)
// ---------------------------------------------------------------------------
export async function createOpportunityAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = opportunitySchema.safeParse({ ...raw, is_remote: raw.is_remote === "on" });
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("opportunities").insert({ ...parsed.data, company_id: user.id });
  if (error) return { error: /row-level security/i.test(error.message) ? "La publication d'opportunités nécessite un compte professionnel avec l'offre VENTURE Business." : toUserMessage(error) };
  revalidatePath("/business");
  revalidatePath("/explore");
  return { ok: true, message: "Opportunité publiée." };
}

export async function closeOpportunityAction(id: string, open: boolean): Promise<ActionState> {
  const { supabase } = await authed();
  const { data, error } = await supabase.from("opportunities").update({ is_open: open }).eq("id", id).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath("/business");
  return { ok: true };
}

export async function respondOpportunityAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ opportunity_id: uuid, message: z.string().trim().min(10).max(1500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ton message doit contenir entre 10 et 1500 caractères." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("opportunity_responses").insert({ ...parsed.data, user_id: user.id });
  if (error) return { error: error.code === "23505" ? "Tu as déjà répondu à cette opportunité." : toUserMessage(error) };
  return { ok: true, message: "Réponse envoyée à l'entreprise." };
}
