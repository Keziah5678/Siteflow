"use client";
/**
 * Supabase repository — hosted mode. Every call runs under the signed-in
 * user's JWT, so Row Level Security (supabase/migrations) is what actually
 * decides; multi-row operations go through the transactional RPCs.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeConstitution } from "../engine/constitution";
import type { LawImpact } from "../engine/guardian";
import type { SimulationResult } from "../engine/simulation";
import type {
  Activity, AppNotification, ChangeType, Constitution, Entity, GuardianReport, Invitation, Member, Proposal,
  ProposalAction, Relation, Revision, Role, TimelineEvent, World, WorldState
} from "../engine/types";
import { roleOf } from "../engine/permissions";
import { RepoError, type EntityInput, type NewEvent, type Repository, type Session, type WorldSummary } from "./repository";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FRIENDLY: Record<string, string> = {
  version_conflict: "Cet élément a été modifié entre-temps. Rechargez avant de réessayer.",
  stale_simulation: "Le monde a changé depuis la prévisualisation : relancez-la.",
  creator_only: "Seul le créateur peut faire cela.",
  forbidden: "Action non autorisée pour votre rôle.",
  forbidden_time_advance: "Seuls le créateur et les administrateurs font avancer le temps.",
  history_is_immutable: "L'histoire établie ne se réécrit pas : utilisez une correction.",
  time_cannot_go_backwards: "Le temps ne recule pas.",
  invitation_not_for_you: "Cette invitation est destinée à une autre adresse.",
  invitation_unavailable: "Invitation indisponible.",
  parent_outside_world: "Le parent doit appartenir à ce monde.",
  "row-level security": "Action non autorisée pour votre rôle dans ce monde."
};

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "Erreur inconnue";
  const key = Object.keys(FRIENDLY).find(k => msg.includes(k));
  throw new RepoError(key ? FRIENDLY[key] : msg, key ?? error?.code ?? "db");
}

const toWorld = (r: Row): World => ({
  id: r.id, ownerId: r.owner_id, name: r.name, description: r.description ?? "", visibility: r.visibility ?? "private",
  constitution: normalizeConstitution(r.constitution), constitutionVersion: r.constitution_version ?? 1,
  visualBible: r.visual_bible ?? {}, tick: Number(r.tick ?? 0), coverUrl: r.cover_url ?? null, createdAt: r.created_at, updatedAt: r.updated_at
});
const toEntity = (r: Row): Entity => ({
  id: r.id, worldId: r.world_id, kind: r.kind, name: r.name, summary: r.summary ?? "", parentId: r.parent_id, x: r.x, y: r.y,
  status: r.status, importance: r.importance, data: r.data ?? {}, imageUrl: r.image_url, bornTick: r.born_tick == null ? null : Number(r.born_tick),
  endedTick: r.ended_tick == null ? null : Number(r.ended_tick), tensions: r.tensions ?? [], version: r.version, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at
});
const toRelation = (r: Row): Relation => ({ id: r.id, worldId: r.world_id, sourceId: r.source_id, targetId: r.target_id, type: r.type, data: r.data ?? {}, sinceTick: Number(r.since_tick), untilTick: r.until_tick == null ? null : Number(r.until_tick) });
const toEvent = (r: Row): TimelineEvent => ({
  id: r.id, worldId: r.world_id, tick: Number(r.tick), title: r.title, description: r.description, kind: r.kind, entityIds: r.entity_ids ?? [],
  consequences: Array.isArray(r.consequences) ? r.consequences : [], source: r.source, simulationId: r.simulation_id, canon: r.canon, supersededBy: r.superseded_by, createdBy: r.created_by, createdAt: r.created_at
});
const toEntityJson = (e: EntityInput) => {
  const o: Row = {};
  for (const k of ["id", "kind", "name", "summary", "parentId", "x", "y", "status", "importance", "data", "imageUrl", "bornTick", "endedTick"] as const) if (e[k] !== undefined) o[k] = e[k];
  return o;
};

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  readonly sb: SupabaseClient;
  private names = new Map<string, string>();

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) throw new RepoError("Authentification requise.", "auth");
    return data.session.user.id;
  }
  private async displayNames(ids: string[]): Promise<Map<string, string>> {
    const missing = [...new Set(ids)].filter(id => id && !this.names.has(id));
    if (missing.length) {
      const { data } = await this.sb.from("profiles").select("id,display_name").in("id", missing);
      for (const p of data ?? []) this.names.set(p.id, p.display_name ?? "Créateur");
    }
    return this.names;
  }

  /* ------------------------------------------------------------- auth */
  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const s = data.session;
    if (!s) return null;
    const names = await this.displayNames([s.user.id]);
    return { userId: s.user.id, email: s.user.email ?? "", displayName: names.get(s.user.id) ?? (s.user.user_metadata?.display_name as string) ?? s.user.email ?? "", accessToken: s.access_token };
  }
  onAuthChange(cb: (s: Session | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange(() => { this.getSession().then(cb); });
    return () => data.subscription.unsubscribe();
  }
  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/worlds` : undefined } });
    if (error) fail(error);
    return { needsConfirmation: !data.session };
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new RepoError(error.message.includes("Invalid login") ? "Identifiants incorrects." : error.message.includes("not confirmed") ? "Confirmez votre adresse e-mail avant de vous connecter." : error.message, "auth");
  }
  async signOut() { await this.sb.auth.signOut(); }
  async resetPassword(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth?mode=update` : undefined });
    if (error) fail(error);
  }
  async updateProfile(displayName: string) {
    const id = await this.uid();
    const { error } = await this.sb.from("profiles").upsert({ id, display_name: displayName.trim().slice(0, 60) });
    if (error) fail(error);
    this.names.set(id, displayName.trim());
  }

  /* ----------------------------------------------------------- worlds */
  private async summaries(rows: Row[], uid: string | null): Promise<WorldSummary[]> {
    const ids = rows.map(r => r.id);
    const [members, counts] = await Promise.all([
      uid && ids.length ? this.sb.from("world_members").select("world_id,role").eq("user_id", uid).in("world_id", ids) : Promise.resolve({ data: [] as Row[] }),
      ids.length ? this.sb.from("entities").select("world_id").in("world_id", ids).neq("status", "archived") : Promise.resolve({ data: [] as Row[] })
    ]);
    const names = await this.displayNames(rows.map(r => r.owner_id));
    return rows.map(r => {
      const w = toWorld(r);
      const role = (members.data ?? []).find((m: Row) => m.world_id === r.id)?.role as Role | undefined;
      return {
        id: w.id, name: w.name, description: w.description, visibility: w.visibility, tick: w.tick, coverUrl: w.coverUrl, updatedAt: w.updatedAt, ownerId: w.ownerId,
        role: w.ownerId === uid ? "creator" : role ?? (w.visibility === "public" ? "reader" : null), worldType: w.constitution.worldType,
        entityCount: (counts.data ?? []).filter((c: Row) => c.world_id === r.id).length, ownerName: names.get(w.ownerId)
      };
    });
  }
  async listWorlds() {
    const uid = await this.uid();
    const { data: mem } = await this.sb.from("world_members").select("world_id").eq("user_id", uid);
    const ids = (mem ?? []).map(m => m.world_id);
    const { data, error } = await this.sb.from("worlds").select("*").is("archived_at", null).or(`owner_id.eq.${uid}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`).order("updated_at", { ascending: false });
    if (error) fail(error);
    return this.summaries(data ?? [], uid);
  }
  async listPublicWorlds() {
    const { data, error } = await this.sb.from("worlds").select("*").eq("visibility", "public").is("archived_at", null).order("updated_at", { ascending: false }).limit(60);
    if (error) fail(error);
    const s = await this.sb.auth.getSession();
    return this.summaries(data ?? [], s.data.session?.user.id ?? null);
  }
  async createWorld(input: { id?: string; name: string; description: string; constitution: Constitution; visibility: World["visibility"]; visualBible?: Record<string, unknown> }) {
    const uid = await this.uid();
    const id = input.id ?? crypto.randomUUID();
    const { data, error } = await this.sb.from("worlds").insert({ id, owner_id: uid, name: input.name.trim(), description: input.description.trim(), constitution: input.constitution, visibility: input.visibility, visual_bible: input.visualBible ?? {} }).select().single();
    if (error) fail(error);
    await this.sb.from("world_events").insert({ world_id: id, tick: 0, title: `Naissance de ${input.name.trim()}`, description: input.description.trim() || "Le monde vient d'être créé.", kind: "creation", source: "creator", created_by: uid });
    await this.logActivity(id, "create_world", "world", id, `Création du monde « ${input.name.trim()} »`);
    return toWorld(data);
  }
  async updateWorld(id: string, patch: Partial<Pick<World, "name" | "description" | "visibility" | "coverUrl" | "visualBible">>) {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.visibility !== undefined) row.visibility = patch.visibility;
    if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
    if (patch.visualBible !== undefined) row.visual_bible = patch.visualBible;
    const { error, count } = await this.sb.from("worlds").update(row, { count: "exact" }).eq("id", id);
    if (error) fail(error);
    if (count === 0) throw new RepoError("Action non autorisée pour votre rôle.", "forbidden");
  }
  async archiveWorld(id: string) {
    const { error } = await this.sb.from("worlds").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) fail(error);
  }
  async loadWorld(id: string): Promise<WorldState> {
    const [w, e, r, ev, m] = await Promise.all([
      this.sb.from("worlds").select("*").eq("id", id).maybeSingle(),
      this.sb.from("entities").select("*").eq("world_id", id).limit(5000),
      this.sb.from("entity_relations").select("*").eq("world_id", id).limit(10000),
      this.sb.from("world_events").select("*").eq("world_id", id).order("tick").order("created_at").limit(5000),
      this.sb.from("world_members").select("world_id,user_id,role,created_at").eq("world_id", id)
    ]);
    if (w.error) fail(w.error);
    if (!w.data) throw new RepoError("Monde introuvable ou privé.", "not_found");
    const names = await this.displayNames((m.data ?? []).map(x => x.user_id));
    const members: Member[] = (m.data ?? []).map(x => ({ worldId: x.world_id, userId: x.user_id, role: x.role, createdAt: x.created_at, displayName: names.get(x.user_id) ?? "Membre" }));
    return { world: toWorld(w.data), entities: (e.data ?? []).map(toEntity), relations: (r.data ?? []).map(toRelation), events: (ev.data ?? []).map(toEvent), members };
  }

  /* ------------------------------------------------------------ canon */
  async saveEntity(worldId: string, entity: EntityInput, change: { type: ChangeType; reason: string }, expectedVersion?: number) {
    const { data, error } = await this.sb.rpc("arthenis_save_entity", { p_world: worldId, p_entity: toEntityJson(entity), p_change_type: change.type, p_reason: change.reason, p_expected_version: expectedVersion ?? null });
    if (error) fail(error);
    return toEntity(data as Row);
  }
  async addRelation(worldId: string, rel: Omit<Relation, "id" | "worldId" | "data"> & { data?: Record<string, unknown> }) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("entity_relations").insert({ world_id: worldId, source_id: rel.sourceId, target_id: rel.targetId, type: rel.type, data: rel.data ?? {}, since_tick: rel.sinceTick, until_tick: rel.untilTick, created_by: uid }).select().single();
    if (error) fail(error);
    return toRelation(data);
  }
  async endRelation(worldId: string, relationId: string, untilTick: number) {
    const { error } = await this.sb.from("entity_relations").update({ until_tick: untilTick }).eq("id", relationId).eq("world_id", worldId).is("until_tick", null);
    if (error) fail(error);
  }
  async addEvent(worldId: string, ev: NewEvent) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("world_events").insert({ world_id: worldId, tick: ev.tick, title: ev.title, description: ev.description, kind: ev.kind, entity_ids: ev.entityIds, consequences: ev.consequences, source: ev.source ?? "creator", created_by: uid }).select().single();
    if (error) fail(error);
    return toEvent(data);
  }
  async correctEvent(eventId: string, title: string, description: string, reason: string, kind: "correction" | "retcon") {
    const { error } = await this.sb.rpc("arthenis_correct_event", { p_event: eventId, p_title: title, p_description: description, p_reason: reason, p_kind: kind });
    if (error) fail(error);
  }
  async applySimulation(worldId: string, sim: SimulationResult) {
    const { data, error } = await this.sb.rpc("arthenis_apply_simulation", { p_world: worldId, p_sim: sim });
    if (error) fail(error);
    return Number(data);
  }
  async amendConstitution(worldId: string, constitution: Constitution, reason: string, impact: LawImpact) {
    const { data, error } = await this.sb.rpc("arthenis_amend_constitution", { p_world: worldId, p_constitution: constitution, p_reason: reason, p_impact: impact });
    if (error) fail(error);
    return Number(data);
  }
  async listRevisions(worldId: string, targetId?: string) {
    let q = this.sb.from("revisions").select("*").eq("world_id", worldId).order("created_at", { ascending: false }).limit(300);
    if (targetId) q = q.eq("target_id", targetId);
    const { data, error } = await q;
    if (error) fail(error);
    return (data ?? []).map((r): Revision => ({ id: r.id, worldId: r.world_id, targetType: r.target_type, targetId: r.target_id, version: r.version, changeType: r.change_type, before: r.before, after: r.after, reason: r.reason, authorId: r.author_id, createdAt: r.created_at }));
  }

  /* ---------------------------------------------------- collaboration */
  async listProposals(worldId: string) {
    const { data, error } = await this.sb.from("proposals").select("*").eq("world_id", worldId).order("created_at", { ascending: false }).limit(200);
    if (error) fail(error);
    const names = await this.displayNames((data ?? []).map(p => p.author_id));
    return (data ?? []).map((p): Proposal => ({ id: p.id, worldId: p.world_id, authorId: p.author_id, authorName: names.get(p.author_id) ?? "Contributeur", action: p.action, targetId: p.target_id, payload: p.payload, guardian: p.guardian, status: p.status, reviewNote: p.review_note, reviewedBy: p.reviewed_by, createdAt: p.created_at, reviewedAt: p.reviewed_at }));
  }
  async submitProposal(worldId: string, action: ProposalAction, payload: Record<string, unknown>, guardian: GuardianReport | null, targetId: string | null = null) {
    const uid = await this.uid();
    const { data, error } = await this.sb.from("proposals").insert({ world_id: worldId, author_id: uid, action, payload, guardian, target_id: targetId }).select().single();
    if (error) fail(error);
    await this.logActivity(worldId, "propose", "proposal", data.id, `Proposition : ${String((payload.entity as { name?: string } | undefined)?.name ?? action)}`);
    return { id: data.id, worldId, authorId: uid, authorName: "", action, targetId, payload, guardian, status: "pending", reviewNote: "", reviewedBy: null, createdAt: data.created_at, reviewedAt: null } as Proposal;
  }
  async reviewProposal(id: string, approve: boolean, note: string, entity?: EntityInput) {
    const { error } = await this.sb.rpc("arthenis_review_proposal", { p_proposal: id, p_approve: approve, p_note: note, p_entity: entity ? toEntityJson(entity) : null });
    if (error) fail(error);
  }
  async withdrawProposal(id: string) {
    const { error } = await this.sb.from("proposals").update({ status: "withdrawn" }).eq("id", id);
    if (error) fail(error);
  }

  async listInvitations(worldId: string) {
    const { data, error } = await this.sb.from("world_invitations").select("*").eq("world_id", worldId).order("created_at", { ascending: false });
    if (error) fail(error);
    return (data ?? []).map((i): Invitation => ({ id: i.id, worldId: i.world_id, email: i.email, role: i.role, status: i.status, invitedBy: i.invited_by, createdAt: i.created_at }));
  }
  async myInvitations() {
    const s = await this.getSession();
    if (!s) return [];
    const { data } = await this.sb.from("world_invitations").select("*, worlds(name)").eq("status", "pending").ilike("email", s.email);
    return (data ?? []).map((i): Invitation => ({ id: i.id, worldId: i.world_id, worldName: i.worlds?.name, email: i.email, role: i.role, status: i.status, invitedBy: i.invited_by, createdAt: i.created_at }));
  }
  async invite(worldId: string, email: string, role: Invitation["role"]) {
    const uid = await this.uid();
    const { error } = await this.sb.from("world_invitations").insert({ world_id: worldId, email: email.trim().toLowerCase(), role, invited_by: uid });
    if (error) fail(error.message.includes("duplicate") ? { message: "Une invitation est déjà en attente pour cette adresse." } : error);
    await this.logActivity(worldId, "invite", "invitation", null, `Invitation de ${email.trim().toLowerCase()} (${role})`);
  }
  async revokeInvitation(id: string) {
    const { error } = await this.sb.from("world_invitations").update({ status: "revoked" }).eq("id", id);
    if (error) fail(error);
  }
  async acceptInvitation(id: string) {
    const { data, error } = await this.sb.rpc("arthenis_accept_invitation", { p_invitation: id });
    if (error) fail(error);
    return String(data);
  }
  async setMemberRole(worldId: string, userId: string, role: Exclude<Role, "creator">) {
    const { error, count } = await this.sb.from("world_members").update({ role }, { count: "exact" }).eq("world_id", worldId).eq("user_id", userId);
    if (error) fail(error);
    if (!count) throw new RepoError("Changement de rôle non autorisé.", "forbidden");
  }
  async removeMember(worldId: string, userId: string) {
    const { error, count } = await this.sb.from("world_members").delete({ count: "exact" }).eq("world_id", worldId).eq("user_id", userId);
    if (error) fail(error);
    if (!count) throw new RepoError("Non autorisé.", "forbidden");
  }
  async listMembers(worldId: string) {
    return (await this.loadWorld(worldId)).members;
  }

  async listActivity(worldId: string) {
    const { data } = await this.sb.from("activity_log").select("*").eq("world_id", worldId).order("created_at", { ascending: false }).limit(200);
    const names = await this.displayNames((data ?? []).map(a => a.actor_id));
    return (data ?? []).map((a): Activity => ({ id: a.id, worldId: a.world_id, actorId: a.actor_id, actorName: names.get(a.actor_id) ?? "Système", action: a.action, targetType: a.target_type, targetId: a.target_id, summary: a.summary, createdAt: a.created_at }));
  }
  async logActivity(worldId: string, action: string, targetType: string, targetId: string | null, summary: string) {
    const uid = await this.uid();
    await this.sb.from("activity_log").insert({ world_id: worldId, actor_id: uid, action, target_type: targetType, target_id: targetId, summary: summary.slice(0, 1000) });
  }
  async listNotifications() {
    const s = await this.sb.auth.getSession();
    if (!s.data.session) return [];
    const { data } = await this.sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    return (data ?? []).map((n): AppNotification => ({ id: n.id, userId: n.user_id, worldId: n.world_id, title: n.title, body: n.body, readAt: n.read_at, createdAt: n.created_at }));
  }
  async markNotificationsRead() {
    const uid = await this.uid();
    await this.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", uid).is("read_at", null);
  }

  subscribe(worldId: string, cb: () => void) {
    let t: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => { if (t) clearTimeout(t); t = setTimeout(cb, 250); };
    const ch = this.sb.channel(`world:${worldId}`);
    for (const table of ["entities", "entity_relations", "world_events", "proposals", "world_members"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `world_id=eq.${worldId}` }, debounced);
    }
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "worlds", filter: `id=eq.${worldId}` }, debounced);
    ch.subscribe();
    return () => { if (t) clearTimeout(t); this.sb.removeChannel(ch); };
  }

  async saveAsset(_worldId: string, _entityId: string | null, image: { dataUrl?: string; url?: string; storagePath?: string }) {
    // The image route already uploaded and recorded the asset under the user's JWT.
    if (image.storagePath) return `storage:${image.storagePath}`;
    if (image.url) return image.url;
    if (image.dataUrl) return image.dataUrl;
    throw new RepoError("Image vide.", "validation");
  }
  private signed = new Map<string, { url: string; exp: number }>();
  async resolveImage(ref: string) {
    if (!ref.startsWith("storage:")) return ref;
    const path = ref.slice(8);
    const hit = this.signed.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data } = await this.sb.storage.from("arthenis-assets").createSignedUrl(path, 3600);
    if (!data?.signedUrl) return "";
    this.signed.set(path, { url: data.signedUrl, exp: Date.now() + 3300_000 });
    return data.signedUrl;
  }
}

export { roleOf };
