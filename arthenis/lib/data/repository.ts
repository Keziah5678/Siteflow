import type { LawImpact } from "../engine/guardian";
import type { SimulationResult } from "../engine/simulation";
import type {
  Activity, AppNotification, ChangeType, Constitution, Entity, GuardianReport, Invitation, Member,
  Proposal, ProposalAction, Relation, Revision, Role, TimelineEvent, Visibility, World, WorldState
} from "../engine/types";

export type Session = { userId: string; email: string; displayName: string; accessToken: string | null };

export type WorldSummary = Pick<World, "id" | "name" | "description" | "visibility" | "tick" | "coverUrl" | "updatedAt" | "ownerId"> & {
  role: Role | null;
  worldType: Constitution["worldType"];
  entityCount: number;
  ownerName?: string;
};

export type EntityInput = Partial<Omit<Entity, "worldId" | "version" | "createdBy" | "createdAt" | "updatedAt">> & { kind?: Entity["kind"]; name?: string };

export type NewEvent = Pick<TimelineEvent, "tick" | "title" | "description" | "kind" | "entityIds" | "consequences"> & { source?: TimelineEvent["source"] };

export class RepoError extends Error {
  constructor(message: string, readonly code: string = "error") { super(message); }
}

/** Every storage backend implements this. The UI never talks to a backend directly. */
export interface Repository {
  readonly mode: "local" | "supabase";

  getSession(): Promise<Session | null>;
  onAuthChange(cb: (s: Session | null) => void): () => void;
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updateProfile(displayName: string): Promise<void>;

  listWorlds(): Promise<WorldSummary[]>;
  listPublicWorlds(): Promise<WorldSummary[]>;
  createWorld(input: { id?: string; name: string; description: string; constitution: Constitution; visibility: Visibility; visualBible?: Record<string, unknown> }): Promise<World>;
  updateWorld(id: string, patch: Partial<Pick<World, "name" | "description" | "visibility" | "coverUrl" | "visualBible">>): Promise<void>;
  archiveWorld(id: string): Promise<void>;
  loadWorld(id: string): Promise<WorldState>;

  saveEntity(worldId: string, entity: EntityInput, change: { type: ChangeType; reason: string }, expectedVersion?: number): Promise<Entity>;
  addRelation(worldId: string, rel: Omit<Relation, "id" | "worldId" | "data"> & { data?: Record<string, unknown> }): Promise<Relation>;
  endRelation(worldId: string, relationId: string, untilTick: number): Promise<void>;
  addEvent(worldId: string, ev: NewEvent): Promise<TimelineEvent>;
  correctEvent(eventId: string, title: string, description: string, reason: string, kind: "correction" | "retcon"): Promise<void>;
  applySimulation(worldId: string, sim: SimulationResult): Promise<number>;
  amendConstitution(worldId: string, constitution: Constitution, reason: string, impact: LawImpact): Promise<number>;
  listRevisions(worldId: string, targetId?: string): Promise<Revision[]>;

  listProposals(worldId: string): Promise<Proposal[]>;
  submitProposal(worldId: string, action: ProposalAction, payload: Record<string, unknown>, guardian: GuardianReport | null, targetId?: string | null): Promise<Proposal>;
  reviewProposal(id: string, approve: boolean, note: string, entity?: EntityInput): Promise<void>;
  withdrawProposal(id: string): Promise<void>;

  listInvitations(worldId: string): Promise<Invitation[]>;
  myInvitations(): Promise<Invitation[]>;
  invite(worldId: string, email: string, role: Invitation["role"]): Promise<void>;
  revokeInvitation(id: string): Promise<void>;
  acceptInvitation(id: string): Promise<string>;
  setMemberRole(worldId: string, userId: string, role: Exclude<Role, "creator">): Promise<void>;
  removeMember(worldId: string, userId: string): Promise<void>;
  listMembers(worldId: string): Promise<Member[]>;

  listActivity(worldId: string): Promise<Activity[]>;
  logActivity(worldId: string, action: string, targetType: string, targetId: string | null, summary: string): Promise<void>;
  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(): Promise<void>;

  /** Called whenever another tab, device or collaborator changes the world. */
  subscribe(worldId: string, cb: () => void): () => void;

  /** Stores a generated image; returns a reference usable as entity.imageUrl. */
  saveAsset(worldId: string, entityId: string | null, image: { dataUrl?: string; url?: string; storagePath?: string }, prompt: string, model: string): Promise<string>;
  /** Turns a stored reference (idb:…, storage:…) into something an <img> can show. */
  resolveImage(ref: string): Promise<string>;
}
