"use client";
/**
 * Local repository — used when Supabase is not configured.
 *
 * Mirrors the semantics of the SQL schema (roles, append-only revisions,
 * immutable history, optimistic versions, stale simulations) so the whole
 * product works offline and can be tested end to end. It is NOT a security
 * boundary: anyone with access to this browser profile can read its data.
 * The database (RLS) is the security boundary in hosted mode.
 */
import { normalizeConstitution } from "../engine/constitution";
import { can, roleOf, ROLE_RANK } from "../engine/permissions";
import type { LawImpact } from "../engine/guardian";
import type { SimulationResult } from "../engine/simulation";
import type {
  Activity, AppNotification, ChangeType, Constitution, Entity, GuardianReport, Invitation, Member, Proposal,
  ProposalAction, Relation, Revision, Role, TimelineEvent, World, WorldState
} from "../engine/types";
import { RepoError, type EntityInput, type NewEvent, type Repository, type Session, type WorldSummary } from "./repository";

type User = { id: string; email: string; displayName: string; salt: string; hash: string; createdAt: string };
type Db = {
  version: 2;
  users: User[];
  session: { userId: string } | null;
  worlds: (World & { archivedAt?: string | null })[];
  members: Member[];
  entities: Entity[];
  relations: Relation[];
  events: TimelineEvent[];
  revisions: Revision[];
  proposals: Proposal[];
  invitations: Invitation[];
  activity: Activity[];
  notifications: AppNotification[];
};

const KEY = "arthenis:v2:db";
const empty = (): Db => ({ version: 2, users: [], session: null, worlds: [], members: [], entities: [], relations: [], events: [], revisions: [], proposals: [], invitations: [], activity: [], notifications: [] });
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const clone = <T,>(v: T): T => structuredClone(v);

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120000 }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------ image storage */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("arthenis-images", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("images");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(id: string, dataUrl: string) {
  const db = await idb();
  await new Promise<void>((res, rej) => { const tx = db.transaction("images", "readwrite"); tx.objectStore("images").put(dataUrl, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
async function idbGet(id: string): Promise<string | null> {
  const db = await idb();
  return new Promise((res, rej) => { const req = db.transaction("images").objectStore("images").get(id); req.onsuccess = () => res((req.result as string) ?? null); req.onerror = () => rej(req.error); });
}

export class LocalRepository implements Repository {
  readonly mode = "local" as const;
  private listeners = new Set<(s: Session | null) => void>();
  /** Same-tab subscribers: BroadcastChannel never echoes to its own sender. */
  private worldListeners = new Map<string, Set<() => void>>();
  private channel: BroadcastChannel | null = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("arthenis") : null;

  /* ----------------------------------------------------------- storage */
  private read(): Db {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const db = JSON.parse(raw) as Db;
      return { ...empty(), ...db };
    } catch { return empty(); }
  }
  private write(db: Db, worldId?: string) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new RepoError("Stockage local plein : exportez ou archivez des mondes.", "quota"); }
    if (worldId) {
      this.channel?.postMessage({ worldId });
      const ls = this.worldListeners.get(worldId);
      if (ls) queueMicrotask(() => ls.forEach(l => l()));
    }
  }
  /** Runs a mutation on a fresh copy; nothing is written if it throws (atomicity). */
  private tx<T>(fn: (db: Db) => T, worldId?: string): T {
    const db = this.read();
    const out = fn(db);
    this.write(db, worldId);
    return out;
  }
  private me(db: Db): User {
    const u = db.session ? db.users.find(x => x.id === db.session!.userId) : undefined;
    if (!u) throw new RepoError("Authentification requise.", "auth");
    return u;
  }
  private role(db: Db, worldId: string, userId: string | null): Role | null {
    const w = db.worlds.find(x => x.id === worldId);
    return roleOf(w, db.members.filter(m => m.worldId === worldId), userId);
  }
  private require(db: Db, worldId: string, cap: Parameters<typeof can>[1]): { user: User; world: World; role: Role } {
    const user = this.me(db);
    const world = db.worlds.find(w => w.id === worldId);
    if (!world) throw new RepoError("Monde introuvable.", "not_found");
    const role = this.role(db, worldId, user.id);
    if (!can(role, cap, world.constitution)) throw new RepoError("Action non autorisée pour votre rôle dans ce monde.", "forbidden");
    return { user, world, role: role! };
  }
  private session(db: Db): Session | null {
    const u = db.session ? db.users.find(x => x.id === db.session!.userId) : undefined;
    return u ? { userId: u.id, email: u.email, displayName: u.displayName, accessToken: null } : null;
  }
  private emitAuth() { this.getSession().then(s => this.listeners.forEach(l => l(s))); }
  private log(db: Db, worldId: string, actor: User | null, action: string, targetType: string, targetId: string | null, summary: string) {
    db.activity.push({ id: uuid(), worldId, actorId: actor?.id ?? null, actorName: actor?.displayName ?? "Système", action, targetType, targetId, summary, createdAt: now() });
  }
  private notify(db: Db, userId: string, worldId: string | null, title: string, body: string) {
    db.notifications.push({ id: uuid(), userId, worldId, title, body, readAt: null, createdAt: now() });
  }
  private revision(db: Db, r: Omit<Revision, "id" | "createdAt">) {
    db.revisions.push({ ...r, id: uuid(), createdAt: now() });
  }

  /* -------------------------------------------------------------- auth */
  async getSession() { return this.session(this.read()); }
  onAuthChange(cb: (s: Session | null) => void) {
    this.listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) this.emitAuth(); };
    window.addEventListener("storage", onStorage);
    return () => { this.listeners.delete(cb); window.removeEventListener("storage", onStorage); };
  }
  async signUp(email: string, password: string, displayName: string) {
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new RepoError("Adresse e-mail invalide.", "validation");
    if (password.length < 8) throw new RepoError("Le mot de passe doit contenir au moins 8 caractères.", "validation");
    const salt = uuid();
    const hash = await hashPassword(password, salt);
    this.tx(db => {
      if (db.users.some(u => u.email === mail)) throw new RepoError("Un compte existe déjà avec cette adresse.", "exists");
      const u: User = { id: uuid(), email: mail, displayName: displayName.trim() || mail.split("@")[0], salt, hash, createdAt: now() };
      db.users.push(u);
      db.session = { userId: u.id };
      for (const inv of db.invitations) if (inv.email === mail && inv.status === "pending") this.notify(db, u.id, inv.worldId, "Invitation", `Vous êtes invité(e) à rejoindre « ${inv.worldName ?? "un monde"} ».`);
    });
    this.emitAuth();
    return { needsConfirmation: false };
  }
  async signIn(email: string, password: string) {
    const db = this.read();
    const u = db.users.find(x => x.email === email.trim().toLowerCase());
    if (!u || (await hashPassword(password, u.salt)) !== u.hash) throw new RepoError("Identifiants incorrects.", "auth");
    this.tx(d => { d.session = { userId: u.id }; });
    this.emitAuth();
  }
  async signOut() { this.tx(db => { db.session = null; }); this.emitAuth(); }
  async resetPassword() { throw new RepoError("En mode local, aucun e-mail n'est envoyé : créez un nouveau compte ou connectez Supabase.", "unsupported"); }
  async updateProfile(displayName: string) {
    this.tx(db => {
      const u = this.me(db);
      u.displayName = displayName.trim().slice(0, 60) || u.displayName;
      for (const m of db.members) if (m.userId === u.id) m.displayName = u.displayName;
    });
    this.emitAuth();
  }

  /* ------------------------------------------------------------ worlds */
  private summary(db: Db, w: World, userId: string | null): WorldSummary {
    return {
      id: w.id, name: w.name, description: w.description, visibility: w.visibility, tick: w.tick, coverUrl: w.coverUrl, updatedAt: w.updatedAt, ownerId: w.ownerId,
      role: this.role(db, w.id, userId), worldType: w.constitution.worldType,
      entityCount: db.entities.filter(e => e.worldId === w.id && e.status !== "archived").length,
      ownerName: db.users.find(u => u.id === w.ownerId)?.displayName
    };
  }
  async listWorlds() {
    const db = this.read();
    const u = this.me(db);
    const ids = new Set(db.members.filter(m => m.userId === u.id).map(m => m.worldId));
    return db.worlds.filter(w => !w.archivedAt && (w.ownerId === u.id || ids.has(w.id))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(w => this.summary(db, w, u.id));
  }
  async listPublicWorlds() {
    const db = this.read();
    const uid = db.session?.userId ?? null;
    return db.worlds.filter(w => w.visibility === "public" && !w.archivedAt).map(w => this.summary(db, w, uid));
  }
  async createWorld(input: { id?: string; name: string; description: string; constitution: Constitution; visibility: World["visibility"]; visualBible?: Record<string, unknown> }) {
    const name = input.name.trim();
    if (!name || name.length > 120) throw new RepoError("Le nom doit faire entre 1 et 120 caractères.", "validation");
    return this.tx(db => {
      const u = this.me(db);
      const w: World = {
        id: input.id ?? uuid(), ownerId: u.id, name, description: input.description.trim(), visibility: input.visibility,
        constitution: normalizeConstitution(input.constitution), constitutionVersion: 1, visualBible: input.visualBible ?? {},
        tick: 0, coverUrl: null, createdAt: now(), updatedAt: now()
      };
      db.worlds.push(w);
      db.members.push({ worldId: w.id, userId: u.id, displayName: u.displayName, role: "creator", createdAt: now() });
      this.revision(db, { worldId: w.id, targetType: "constitution", targetId: w.id, version: 1, changeType: "create", before: null, after: w.constitution, reason: "Constitution fondatrice", authorId: u.id });
      db.events.push({ id: uuid(), worldId: w.id, tick: 0, title: `Naissance de ${w.name}`, description: w.description || "Le monde vient d'être créé.", kind: "creation", entityIds: [], consequences: [], source: "creator", simulationId: null, canon: true, supersededBy: null, createdBy: u.id, createdAt: now() });
      this.log(db, w.id, u, "create_world", "world", w.id, `Création du monde « ${w.name} »`);
      return clone(w);
    }, input.id);
  }
  async updateWorld(id: string, patch: Partial<Pick<World, "name" | "description" | "visibility" | "coverUrl" | "visualBible">>) {
    this.tx(db => {
      const { user, world, role } = this.require(db, id, "simulate");
      if (patch.visibility && patch.visibility !== world.visibility && role !== "creator") throw new RepoError("Seul le créateur change la visibilité.", "forbidden");
      Object.assign(world, patch, { updatedAt: now() });
      this.log(db, id, user, "update_world", "world", id, "Paramètres du monde modifiés");
    }, id);
  }
  async archiveWorld(id: string) {
    this.tx(db => {
      const { user, world } = this.require(db, id, "manage_world");
      (world as Db["worlds"][number]).archivedAt = now();
      this.log(db, id, user, "archive_world", "world", id, "Monde archivé");
    }, id);
  }
  async loadWorld(id: string): Promise<WorldState> {
    const db = this.read();
    const w = db.worlds.find(x => x.id === id);
    if (!w) throw new RepoError("Monde introuvable.", "not_found");
    const uid = db.session?.userId ?? null;
    if (!this.role(db, id, uid)) throw new RepoError("Ce monde est privé.", "forbidden");
    return clone({
      world: { ...w, constitution: normalizeConstitution(w.constitution) },
      entities: db.entities.filter(e => e.worldId === id),
      relations: db.relations.filter(r => r.worldId === id),
      events: db.events.filter(e => e.worldId === id).sort((a, b) => a.tick - b.tick || a.createdAt.localeCompare(b.createdAt)),
      members: db.members.filter(m => m.worldId === id)
    });
  }

  /* ------------------------------------------------------------- canon */
  async saveEntity(worldId: string, input: EntityInput, change: { type: ChangeType; reason: string }, expectedVersion?: number) {
    return this.tx(db => {
      const { user } = this.require(db, worldId, "write");
      const existing = input.id ? db.entities.find(e => e.id === input.id && e.worldId === worldId) : undefined;
      if (input.parentId && !db.entities.some(e => e.id === input.parentId && e.worldId === worldId)) throw new RepoError("Le parent doit appartenir à ce monde.", "validation");
      if (!existing) {
        if (!input.kind || !input.name?.trim()) throw new RepoError("Type et nom requis.", "validation");
        const e: Entity = {
          id: input.id ?? uuid(), worldId, kind: input.kind, name: input.name.trim().slice(0, 160), summary: (input.summary ?? "").slice(0, 4000),
          parentId: input.parentId ?? null, x: input.x ?? null, y: input.y ?? null, status: input.status ?? "active", importance: input.importance ?? 3,
          data: input.data ?? {}, imageUrl: input.imageUrl ?? null, bornTick: input.bornTick ?? null, endedTick: input.endedTick ?? null,
          tensions: [], version: 1, createdBy: user.id, createdAt: now(), updatedAt: now()
        };
        db.entities.push(e);
        this.revision(db, { worldId, targetType: "entity", targetId: e.id, version: 1, changeType: "create", before: null, after: clone(e), reason: change.reason, authorId: user.id });
        return clone(e);
      }
      if (expectedVersion != null && existing.version !== expectedVersion) throw new RepoError("Cet élément a été modifié entre-temps. Rechargez avant de réessayer.", "version_conflict");
      const before = clone(existing);
      const { id: _i, ...rest } = input;
      void _i;
      Object.assign(existing, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
      if (change.type === "correction" || change.type === "retcon") existing.tensions = [];
      if (JSON.stringify(before) === JSON.stringify(existing)) return clone(existing);
      existing.version = before.version + 1;
      existing.updatedAt = now();
      this.revision(db, { worldId, targetType: "entity", targetId: existing.id, version: existing.version, changeType: change.type, before, after: clone(existing), reason: change.reason, authorId: user.id });
      return clone(existing);
    }, worldId);
  }
  async addRelation(worldId: string, rel: Omit<Relation, "id" | "worldId" | "data"> & { data?: Record<string, unknown> }) {
    return this.tx(db => {
      this.require(db, worldId, "write");
      if (rel.sourceId === rel.targetId) throw new RepoError("Une relation relie deux éléments distincts.", "validation");
      const r: Relation = { id: uuid(), worldId, data: rel.data ?? {}, sourceId: rel.sourceId, targetId: rel.targetId, type: rel.type, sinceTick: rel.sinceTick, untilTick: rel.untilTick ?? null };
      db.relations.push(r);
      return clone(r);
    }, worldId);
  }
  async endRelation(worldId: string, relationId: string, untilTick: number) {
    this.tx(db => {
      this.require(db, worldId, "write");
      const r = db.relations.find(x => x.id === relationId && x.worldId === worldId);
      if (r && r.untilTick == null) r.untilTick = untilTick;
    }, worldId);
  }
  async addEvent(worldId: string, ev: NewEvent) {
    return this.tx(db => {
      const { user, role } = this.require(db, worldId, "write");
      const e: TimelineEvent = { ...ev, id: uuid(), worldId, source: ev.source ?? (role === "contributor" ? "contributor" : "creator"), simulationId: null, canon: true, supersededBy: null, createdBy: user.id, createdAt: now() };
      db.events.push(e);
      return clone(e);
    }, worldId);
  }
  async correctEvent(eventId: string, title: string, description: string, reason: string, kind: "correction" | "retcon") {
    const db0 = this.read();
    const old = db0.events.find(e => e.id === eventId);
    if (!old) throw new RepoError("Événement introuvable.", "not_found");
    this.tx(db => {
      const { user } = this.require(db, old.worldId, "simulate");
      const o = db.events.find(e => e.id === eventId)!;
      if (!o.canon) throw new RepoError("Cet événement a déjà été corrigé.", "already");
      const n: TimelineEvent = { ...o, id: uuid(), title, description, kind, consequences: [`Remplace : ${o.title}`, `Motif : ${reason}`], source: "creator", simulationId: null, canon: true, supersededBy: null, createdBy: user.id, createdAt: now() };
      db.events.push(n);
      o.canon = false;
      o.supersededBy = n.id;
      this.revision(db, { worldId: o.worldId, targetType: "event", targetId: o.id, version: 2, changeType: kind, before: clone({ ...o, canon: true, supersededBy: null }), after: clone(n), reason, authorId: user.id });
      this.log(db, o.worldId, user, kind, "event", n.id, `${kind === "retcon" ? "Révision" : "Correction"} : ${o.title} → ${title}`);
    }, old.worldId);
  }
  async applySimulation(worldId: string, sim: SimulationResult) {
    return this.tx(db => {
      const { user, world } = this.require(db, worldId, "simulate");
      if (world.tick !== sim.fromTick) throw new RepoError("Le monde a changé depuis la prévisualisation : relancez-la.", "stale_simulation");
      const reason = `Simulation ${sim.fromTick} → ${sim.toTick}`;
      for (const ne of sim.newEntities) {
        const e = { ...clone(ne), createdBy: user.id, createdAt: now(), updatedAt: now() };
        db.entities.push(e);
        this.revision(db, { worldId, targetType: "entity", targetId: e.id, version: 1, changeType: "create", before: null, after: clone(e), reason, authorId: user.id });
      }
      for (const ch of sim.changes) {
        const e = db.entities.find(x => x.id === ch.id && x.worldId === worldId);
        if (!e) continue;
        const before = clone(e);
        if (ch.after.data) e.data = clone(ch.after.data);
        if (ch.after.status) e.status = ch.after.status;
        if (ch.after.kind) e.kind = ch.after.kind;
        if ("endedTick" in ch.after) e.endedTick = ch.after.endedTick ?? null;
        if ("bornTick" in ch.after) e.bornTick = ch.after.bornTick ?? null;
        e.version++;
        e.updatedAt = now();
        this.revision(db, { worldId, targetType: "entity", targetId: e.id, version: e.version, changeType: "simulation", before, after: clone(e), reason, authorId: user.id });
      }
      for (const r of sim.newRelations) db.relations.push(clone(r));
      for (const er of sim.endedRelations) { const r = db.relations.find(x => x.id === er.id); if (r && r.untilTick == null) r.untilTick = er.untilTick; }
      for (const ev of sim.events) db.events.push({ ...ev, id: uuid(), worldId, source: "simulation", simulationId: sim.id, canon: true, supersededBy: null, createdBy: user.id, createdAt: now() });
      world.tick = sim.toTick;
      world.updatedAt = now();
      this.log(db, worldId, user, "simulate", "world", worldId, `Le temps avance de ${sim.toTick - sim.fromTick} jour(s) — ${sim.events.length} événement(s).`);
      return sim.toTick;
    }, worldId);
  }
  async amendConstitution(worldId: string, constitution: Constitution, reason: string, impact: LawImpact) {
    if (!reason.trim()) throw new RepoError("Un amendement doit être motivé.", "validation");
    return this.tx(db => {
      const { user, world } = this.require(db, worldId, "amend_laws");
      const v = world.constitutionVersion + 1;
      this.revision(db, { worldId, targetType: "constitution", targetId: worldId, version: v, changeType: "law_change", before: clone(world.constitution), after: clone(constitution), reason, authorId: user.id });
      world.constitution = normalizeConstitution(constitution);
      world.constitutionVersion = v;
      world.updatedAt = now();
      db.events.push({ id: uuid(), worldId, tick: world.tick, title: "Amendement de la constitution", description: reason, kind: "law_change", entityIds: impact.newlyConflicting.map(x => x.entityId), consequences: impact.changes, source: "creator", simulationId: null, canon: true, supersededBy: null, createdBy: user.id, createdAt: now() });
      for (const x of impact.newlyConflicting) {
        const e = db.entities.find(y => y.id === x.entityId);
        if (e) { const before = clone(e); e.tensions = [...new Set([...e.tensions, `constitution:v${v}`])]; e.version++; this.revision(db, { worldId, targetType: "entity", targetId: e.id, version: e.version, changeType: "law_change", before, after: clone(e), reason, authorId: user.id }); }
      }
      for (const x of impact.resolved) {
        const e = db.entities.find(y => y.id === x.entityId);
        if (e && e.tensions.length) { const before = clone(e); e.tensions = []; e.version++; this.revision(db, { worldId, targetType: "entity", targetId: e.id, version: e.version, changeType: "law_change", before, after: clone(e), reason, authorId: user.id }); }
      }
      this.log(db, worldId, user, "amend_laws", "constitution", worldId, reason);
      return v;
    }, worldId);
  }
  async listRevisions(worldId: string, targetId?: string) {
    const db = this.read();
    if (!this.role(db, worldId, db.session?.userId ?? null)) throw new RepoError("Accès refusé.", "forbidden");
    return clone(db.revisions.filter(r => r.worldId === worldId && (!targetId || r.targetId === targetId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  /* ----------------------------------------------------- collaboration */
  async listProposals(worldId: string) {
    const db = this.read();
    const u = this.me(db);
    const role = this.role(db, worldId, u.id);
    return clone(db.proposals.filter(p => p.worldId === worldId && (p.authorId === u.id || can(role, "review"))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  async submitProposal(worldId: string, action: ProposalAction, payload: Record<string, unknown>, guardian: GuardianReport | null, targetId: string | null = null) {
    return this.tx(db => {
      const { user, world } = this.require(db, worldId, "propose");
      const p: Proposal = { id: uuid(), worldId, authorId: user.id, authorName: user.displayName, action, targetId, payload, guardian, status: "pending", reviewNote: "", reviewedBy: null, createdAt: now(), reviewedAt: null };
      db.proposals.push(p);
      for (const m of db.members) if (m.worldId === worldId && ROLE_RANK[m.role] >= 3 && m.userId !== user.id) this.notify(db, m.userId, worldId, "Nouvelle proposition", `${user.displayName} propose une modification dans ${world.name}.`);
      this.log(db, worldId, user, "propose", "proposal", p.id, `Proposition : ${String((payload.entity as { name?: string } | undefined)?.name ?? action)}`);
      return clone(p);
    }, worldId);
  }
  async reviewProposal(id: string, approve: boolean, note: string, entity?: EntityInput) {
    const p0 = this.read().proposals.find(p => p.id === id);
    if (!p0) throw new RepoError("Proposition introuvable.", "not_found");
    if (p0.status !== "pending") throw new RepoError("Cette proposition est déjà close.", "closed");
    let saved: Entity | null = null;
    if (approve && (p0.action === "create" || p0.action === "update")) {
      saved = await this.saveEntity(p0.worldId, entity ?? (p0.payload.entity as EntityInput), { type: p0.action === "create" ? "create" : "update", reason: `Proposition acceptée${note ? ` : ${note}` : ""}` });
    }
    this.tx(db => {
      const { user } = this.require(db, p0.worldId, "review");
      const p = db.proposals.find(x => x.id === id)!;
      p.status = approve ? "approved" : "rejected";
      p.reviewNote = note;
      p.reviewedBy = user.id;
      p.reviewedAt = now();
      this.notify(db, p.authorId, p.worldId, approve ? "Proposition acceptée" : "Proposition refusée", note || (saved ? saved.name : ""));
      this.log(db, p.worldId, user, approve ? "approve_proposal" : "reject_proposal", "proposal", p.id, `${approve ? "Acceptée" : "Refusée"} : ${String((p.payload.entity as { name?: string } | undefined)?.name ?? p.action)}`);
    }, p0.worldId);
  }
  async withdrawProposal(id: string) {
    this.tx(db => {
      const u = this.me(db);
      const p = db.proposals.find(x => x.id === id);
      if (!p || p.authorId !== u.id || p.status !== "pending") throw new RepoError("Impossible de retirer cette proposition.", "forbidden");
      p.status = "withdrawn";
    });
  }

  async listInvitations(worldId: string) {
    const db = this.read();
    this.require(db, worldId, "manage_members");
    return clone(db.invitations.filter(i => i.worldId === worldId));
  }
  async myInvitations() {
    const db = this.read();
    const u = this.me(db);
    return clone(db.invitations.filter(i => i.email === u.email && i.status === "pending"));
  }
  async invite(worldId: string, email: string, role: Invitation["role"]) {
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new RepoError("Adresse e-mail invalide.", "validation");
    this.tx(db => {
      const { user, world, role: mine } = this.require(db, worldId, "manage_members");
      if (ROLE_RANK[role] >= ROLE_RANK[mine]) throw new RepoError("Vous ne pouvez inviter qu'à un rôle inférieur au vôtre.", "forbidden");
      if (db.invitations.some(i => i.worldId === worldId && i.email === mail && i.status === "pending")) throw new RepoError("Une invitation est déjà en attente pour cette adresse.", "exists");
      db.invitations.push({ id: uuid(), worldId, worldName: world.name, email: mail, role, status: "pending", invitedBy: user.id, createdAt: now() });
      const target = db.users.find(u => u.email === mail);
      if (target) this.notify(db, target.id, worldId, "Invitation", `Vous êtes invité(e) à rejoindre « ${world.name} ».`);
      this.log(db, worldId, user, "invite", "invitation", null, `Invitation de ${mail} (${role})`);
    }, worldId);
  }
  async revokeInvitation(id: string) {
    this.tx(db => {
      const inv = db.invitations.find(i => i.id === id);
      if (!inv) return;
      this.require(db, inv.worldId, "manage_members");
      if (inv.status === "pending") inv.status = "revoked";
    });
  }
  async acceptInvitation(id: string) {
    return this.tx(db => {
      const u = this.me(db);
      const inv = db.invitations.find(i => i.id === id);
      if (!inv || inv.status !== "pending") throw new RepoError("Invitation indisponible.", "not_found");
      if (inv.email !== u.email) throw new RepoError("Cette invitation est destinée à une autre adresse.", "forbidden");
      const existing = db.members.find(m => m.worldId === inv.worldId && m.userId === u.id);
      if (existing) { if (existing.role !== "creator") existing.role = inv.role; }
      else db.members.push({ worldId: inv.worldId, userId: u.id, displayName: u.displayName, role: inv.role, createdAt: now() });
      inv.status = "accepted";
      this.log(db, inv.worldId, u, "join", "member", u.id, `${u.displayName} rejoint le monde (${inv.role})`);
      return inv.worldId;
    }, undefined);
  }
  async setMemberRole(worldId: string, userId: string, role: Exclude<Role, "creator">) {
    this.tx(db => {
      const { user, role: mine } = this.require(db, worldId, "manage_members");
      const m = db.members.find(x => x.worldId === worldId && x.userId === userId);
      if (!m || m.role === "creator" || ROLE_RANK[m.role] >= ROLE_RANK[mine] || ROLE_RANK[role] >= ROLE_RANK[mine]) throw new RepoError("Changement de rôle non autorisé.", "forbidden");
      m.role = role;
      this.log(db, worldId, user, "set_role", "member", userId, `${m.displayName} devient ${role}`);
    }, worldId);
  }
  async removeMember(worldId: string, userId: string) {
    this.tx(db => {
      const u = this.me(db);
      const m = db.members.find(x => x.worldId === worldId && x.userId === userId);
      if (!m || m.role === "creator") throw new RepoError("Le créateur ne peut pas être retiré.", "forbidden");
      if (userId !== u.id) {
        const { role: mine } = this.require(db, worldId, "manage_members");
        if (ROLE_RANK[m.role] >= ROLE_RANK[mine]) throw new RepoError("Non autorisé.", "forbidden");
      }
      db.members = db.members.filter(x => x !== m);
      this.log(db, worldId, u, "remove_member", "member", userId, `${m.displayName} quitte le monde`);
    }, worldId);
  }
  async listMembers(worldId: string) {
    const db = this.read();
    return clone(db.members.filter(m => m.worldId === worldId));
  }

  async listActivity(worldId: string) {
    const db = this.read();
    if (!this.role(db, worldId, db.session?.userId ?? null)) return [];
    return clone(db.activity.filter(a => a.worldId === worldId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200));
  }
  async logActivity(worldId: string, action: string, targetType: string, targetId: string | null, summary: string) {
    this.tx(db => { const u = this.me(db); this.log(db, worldId, u, action, targetType, targetId, summary.slice(0, 1000)); }, worldId);
  }
  async listNotifications() {
    const db = this.read();
    const u = db.session?.userId;
    return clone(db.notifications.filter(n => n.userId === u).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100));
  }
  async markNotificationsRead() {
    this.tx(db => { const u = this.me(db); for (const n of db.notifications) if (n.userId === u.id && !n.readAt) n.readAt = now(); });
  }

  subscribe(worldId: string, cb: () => void) {
    const onMsg = (e: MessageEvent) => { if (e.data?.worldId === worldId) cb(); };
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
    this.channel?.addEventListener("message", onMsg);
    window.addEventListener("storage", onStorage);
    if (!this.worldListeners.has(worldId)) this.worldListeners.set(worldId, new Set());
    this.worldListeners.get(worldId)!.add(cb);
    return () => { this.channel?.removeEventListener("message", onMsg); window.removeEventListener("storage", onStorage); this.worldListeners.get(worldId)?.delete(cb); };
  }

  async saveAsset(worldId: string, _entityId: string | null, image: { dataUrl?: string; url?: string }) {
    if (image.url) return image.url;
    if (!image.dataUrl) throw new RepoError("Image vide.", "validation");
    const id = uuid();
    await idbPut(id, image.dataUrl);
    this.channel?.postMessage({ worldId });
    return `idb:${id}`;
  }
  async resolveImage(ref: string) {
    if (ref.startsWith("idb:")) return (await idbGet(ref.slice(4))) ?? "";
    return ref;
  }
}
