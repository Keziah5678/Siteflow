"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import { findCity } from "@/lib/cities";
import {
  applicationSchema,
  calendarSchema,
  commentSchema,
  eurosToCents,
  fieldErrors,
  milestoneSchema,
  projectSchema,
  proposalSchema,
  taskSchema,
  type ProjectInput,
} from "@/lib/validation";
import type { ActionState } from "./types";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const uuid = z.string().uuid();
const p = (id: string) => `/projects/${id}`;

function revalidateProject(id: string) {
  revalidatePath(p(id));
  revalidatePath(`${p(id)}/space`);
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------
/** Covers must come from our own public "covers" bucket (no third-party URLs). */
function isOwnCover(url: string | null): boolean {
  return url === null || url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/`);
}

function projectRow(d: ProjectInput) {
  const city = findCity(d.city);
  return {
    title: d.title,
    description: d.description,
    category: d.category,
    status: d.status,
    goal: d.goal,
    interest_goal: d.interest_goal ?? null,
    skills_needed: d.skills_needed,
    resources_needed: d.resources_needed,
    budget_estimate_cents: eurosToCents(d.budget_estimate_eur),
    city: city?.name ?? d.city,
    lat: city?.lat ?? null,
    lng: city?.lng ?? null,
    is_remote: d.is_remote,
    cover_url: d.cover_url,
  };
}

export async function createProjectAction(raw: unknown): Promise<ActionState> {
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  if (!isOwnCover(parsed.data.cover_url)) return { error: "Image de couverture invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "Connecte-toi pour publier un projet." };
  const d = parsed.data;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ ...projectRow(d), owner_id: user.id })
    .select("id")
    .single();
  if (error || !project) return { error: toUserMessage(error) };

  const steps = (d.first_steps ?? []).slice(0, 12);
  if (steps.length) {
    const { error: mErr } = await supabase.from("milestones").insert(steps.map((title, i) => ({ project_id: project.id, title: title.slice(0, 160), position: i })));
    if (mErr) console.error("[venture] milestones insert", mErr);
  }
  if (d.category === "event") {
    const { error: eErr } = await supabase
      .from("event_details")
      .update({
        venue_idea: d.venue_idea,
        capacity: d.capacity ?? null,
        price_min_cents: eurosToCents(d.price_min_eur),
        price_max_cents: eurosToCents(d.price_max_eur),
        date_options: d.date_options ?? [],
      })
      .eq("project_id", project.id);
    if (eErr) console.error("[venture] event details", eErr);
  }
  revalidatePath("/");
  return { ok: true, data: { id: project.id } };
}

export async function updateProjectAction(projectId: string, raw: unknown): Promise<ActionState> {
  if (!uuid.safeParse(projectId).success) return { error: "Projet invalide." };
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  if (!isOwnCover(parsed.data.cover_url)) return { error: "Image de couverture invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "Session expirée." };
  const d = parsed.data;
  const { data, error } = await supabase.from("projects").update(projectRow(d)).eq("id", projectId).select("id");
  if (error) return { error: toUserMessage(error) };
  if (!data?.length) return { error: toUserMessage({ message: "VENTURE_FORBIDDEN" }) };
  if (d.category === "event") {
    await supabase
      .from("event_details")
      .update({ venue_idea: d.venue_idea, capacity: d.capacity ?? null, price_min_cents: eurosToCents(d.price_min_eur), price_max_cents: eurosToCents(d.price_max_eur), date_options: d.date_options ?? [] })
      .eq("project_id", projectId);
  }
  revalidateProject(projectId);
  return { ok: true, message: "Projet mis à jour." };
}

export async function setProjectStatusAction(projectId: string, status: string): Promise<ActionState> {
  const s = z.enum(["idea", "recruiting", "preparing", "in_progress", "completed", "cancelled"]).safeParse(status);
  if (!uuid.safeParse(projectId).success || !s.success) return { error: "Statut invalide." };
  const { supabase } = await authed();
  const { data, error } = await supabase.from("projects").update({ status: s.data }).eq("id", projectId).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidateProject(projectId);
  return { ok: true };
}

export async function deleteProjectAction(projectId: string): Promise<ActionState> {
  if (!uuid.safeParse(projectId).success) return { error: "Projet invalide." };
  const { supabase } = await authed();
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Participation: interest / participation (not a booking)
// ---------------------------------------------------------------------------
export async function toggleEngagementAction(projectId: string, kind: "interested" | "participating", on: boolean): Promise<ActionState> {
  if (!uuid.safeParse(projectId).success || !["interested", "participating"].includes(kind)) return { error: "Requête invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = on
    ? await supabase.from("project_engagements").insert({ project_id: projectId, user_id: user.id, kind })
    : await supabase.from("project_engagements").delete().eq("project_id", projectId).eq("user_id", user.id).eq("kind", kind);
  if (error && error.code !== "23505") return { error: toUserMessage(error) };
  revalidateProject(projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
export async function applyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("applications").insert({ ...parsed.data, applicant_id: user.id });
  if (error) return { error: error.code === "23505" ? "Tu as déjà une candidature en attente pour ce projet." : toUserMessage(error) };
  revalidateProject(parsed.data.project_id);
  return { ok: true, message: "Candidature envoyée. L'équipe du projet va être notifiée." };
}

export async function decideApplicationAction(applicationId: string, accept: boolean, projectId: string): Promise<ActionState> {
  if (!uuid.safeParse(applicationId).success) return { error: "Requête invalide." };
  const { supabase } = await authed();
  const { error } = await supabase.rpc("decide_application", { p_application: applicationId, p_accept: accept });
  if (error) return { error: toUserMessage(error) };
  revalidateProject(projectId);
  return { ok: true };
}

export async function withdrawApplicationAction(applicationId: string, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { error } = await supabase.rpc("withdraw_application", { p_application: applicationId });
  if (error) return { error: toUserMessage(error) };
  revalidateProject(projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comments & updates
// ---------------------------------------------------------------------------
export async function commentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: fieldErrors(parsed.error).body ?? "Message invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("comments").insert({ ...parsed.data, author_id: user.id });
  if (error) return { error: toUserMessage(error) };
  revalidatePath(p(parsed.data.project_id));
  return { ok: true };
}

export async function deleteCommentAction(commentId: string, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { error: toUserMessage(error) };
  revalidatePath(p(projectId));
  return { ok: true };
}

export async function postUpdateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ project_id: uuid, body: z.string().trim().min(2).max(3000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "L'actualité doit contenir entre 2 et 3000 caractères." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("project_updates").insert({ ...parsed.data, author_id: user.id });
  if (error) return { error: toUserMessage(error) };
  revalidateProject(parsed.data.project_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Milestones (étapes) — progress derives from them
// ---------------------------------------------------------------------------
export async function addMilestoneAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const { supabase } = await authed();
  const { count } = await supabase.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", parsed.data.project_id);
  const { error } = await supabase.from("milestones").insert({ ...parsed.data, position: count ?? 0 });
  if (error) return { error: toUserMessage(error) };
  revalidateProject(parsed.data.project_id);
  return { ok: true };
}

export async function addMilestonesBulkAction(projectId: string, titles: string[]): Promise<ActionState> {
  const parsed = z.array(z.string().trim().min(2).max(160)).min(1).max(12).safeParse(titles);
  if (!uuid.safeParse(projectId).success || !parsed.success) return { error: "Étapes invalides." };
  const { supabase } = await authed();
  const { count } = await supabase.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const { error } = await supabase.from("milestones").insert(parsed.data.map((title, i) => ({ project_id: projectId, title, position: (count ?? 0) + i })));
  if (error) return { error: toUserMessage(error) };
  revalidateProject(projectId);
  return { ok: true, message: `${parsed.data.length} étape(s) ajoutée(s).` };
}

export async function toggleMilestoneAction(milestoneId: string, done: boolean, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { error } = await supabase.rpc("set_milestone_done", { p_milestone: milestoneId, p_done: done });
  if (error) return { error: toUserMessage(error) };
  revalidateProject(projectId);
  return { ok: true };
}

export async function deleteMilestoneAction(milestoneId: string, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { data, error } = await supabase.from("milestones").delete().eq("id", milestoneId).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidateProject(projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export async function addTaskAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = taskSchema.safeParse({ ...raw, assignee_id: raw.assignee_id || null, milestone_id: raw.milestone_id || null, due_date: raw.due_date || null });
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("tasks").insert({ ...parsed.data, created_by: user.id });
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`${p(parsed.data.project_id)}/space`);
  return { ok: true };
}

export async function updateTaskAction(taskId: string, projectId: string, patch: { status?: string; assignee_id?: string | null }): Promise<ActionState> {
  const parsed = z.object({ status: z.enum(["todo", "doing", "done"]).optional(), assignee_id: uuid.nullable().optional() }).safeParse(patch);
  if (!uuid.safeParse(taskId).success || !parsed.success) return { error: "Requête invalide." };
  const { supabase } = await authed();
  const { data, error } = await supabase.from("tasks").update(parsed.data).eq("id", taskId).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath(`${p(projectId)}/space`);
  return { ok: true };
}

export async function deleteTaskAction(taskId: string, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath(`${p(projectId)}/space`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Calendar & documents
// ---------------------------------------------------------------------------
export async function addCalendarEventAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = calendarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const starts = new Date(parsed.data.starts_at);
  if (Number.isNaN(starts.getTime())) return { error: "Date invalide.", fields: { starts_at: "Date invalide" } };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("calendar_events").insert({ ...parsed.data, starts_at: starts.toISOString(), created_by: user.id });
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`${p(parsed.data.project_id)}/space`);
  return { ok: true };
}

export async function deleteCalendarEventAction(id: string, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`${p(projectId)}/space`);
  return { ok: true };
}

export async function registerDocumentAction(input: { project_id: string; name: string; storage_path: string; size_bytes: number; mime_type: string | null }): Promise<ActionState> {
  const parsed = z
    .object({ project_id: uuid, name: z.string().min(1).max(200), storage_path: z.string().min(3).max(400), size_bytes: z.number().int().min(0).max(26214400), mime_type: z.string().max(120).nullable() })
    .safeParse(input);
  if (!parsed.success) return { error: "Fichier invalide." };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { error } = await supabase.from("project_documents").insert({ ...parsed.data, uploaded_by: user.id });
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`${p(parsed.data.project_id)}/space`);
  return { ok: true };
}

export async function deleteDocumentAction(id: string, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { data: doc } = await supabase.from("project_documents").select("storage_path").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("project_documents").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  if (doc) await supabase.storage.from("project-files").remove([doc.storage_path]);
  revalidatePath(`${p(projectId)}/space`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export async function updateMemberAction(projectId: string, userId: string, patch: { role?: "admin" | "member"; responsibility?: string | null }): Promise<ActionState> {
  const parsed = z.object({ role: z.enum(["admin", "member"]).optional(), responsibility: z.string().trim().max(120).nullable().optional() }).safeParse(patch);
  if (!parsed.success) return { error: "Requête invalide." };
  const { supabase } = await authed();
  const { data, error } = await supabase.from("project_members").update(parsed.data).eq("project_id", projectId).eq("user_id", userId).select("user_id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath(`${p(projectId)}/space`);
  return { ok: true };
}

export async function removeMemberAction(projectId: string, userId: string): Promise<ActionState> {
  const { supabase, user } = await authed();
  const { data, error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId).select("user_id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidateProject(projectId);
  if (user?.id === userId) redirect(p(projectId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Events on demand
// ---------------------------------------------------------------------------
export async function setEventStageAction(projectId: string, stage: string, confirmedDate?: string | null): Promise<ActionState> {
  const s = z.enum(["proposed", "preparing", "confirmed", "cancelled"]).safeParse(stage);
  if (!s.success) return { error: "Étape invalide." };
  if (s.data === "confirmed" && !confirmedDate) return { error: "Indique la date confirmée." };
  const { supabase } = await authed();
  const { data, error } = await supabase
    .from("event_details")
    .update({ stage: s.data, confirmed_date: s.data === "confirmed" ? confirmedDate : null })
    .eq("project_id", projectId)
    .select("project_id");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidateProject(projectId);
  return { ok: true };
}

export async function proposeOrganizationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = proposalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const { supabase, user } = await authed();
  if (!user) return { error: "AUTH_REQUIRED" };
  const { proposed_price_eur, ...rest } = parsed.data;
  const { error } = await supabase.from("organizer_proposals").insert({ ...rest, proposed_price_cents: eurosToCents(proposed_price_eur), organizer_id: user.id });
  if (error) return { error: error.code === "23505" ? "Tu as déjà fait une proposition pour cet événement." : toUserMessage(error) };
  revalidatePath(p(parsed.data.project_id));
  return { ok: true, message: "Proposition envoyée au créateur de l'événement." };
}

export async function respondProposalAction(proposalId: string, accept: boolean, projectId: string): Promise<ActionState> {
  const { supabase } = await authed();
  const { error } = await supabase.rpc("respond_proposal", { p_proposal: proposalId, p_accept: accept });
  if (error) return { error: toUserMessage(error) };
  revalidateProject(projectId);
  return { ok: true };
}
