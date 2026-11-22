/**
 * ARTHENIS — domain model.
 *
 * The structured data below is the single source of truth of a world. The AI
 * layers (Guardian, World Brain, Time Engine narration) read it; they never
 * replace it. Everything that happens to a world ends up as rows of these
 * shapes, with an append-only revision trail.
 */
import type { Climate, Era } from "../world/identity";

export type { Climate, Era };

export type Role = "creator" | "admin" | "guardian" | "contributor" | "reader";

export type WorldType =
  | "realiste" | "fantastique" | "medieval" | "futuriste" | "science-fiction"
  | "post-apocalyptique" | "historique" | "contemporain" | "cosmique" | "invente";

export type Realism = "strict" | "plausible" | "libre";

export type Visibility = "private" | "unlisted" | "public";

/* ------------------------------------------------------------------ laws */

export type FundamentalRule = {
  id: string;
  title: string;
  description: string;
  /** Words or phrases that this rule forbids anywhere in the world. */
  forbiddenTerms: string[];
};

export type Constitution = {
  worldType: WorldType;
  era: Era;
  realism: Realism;
  /** Year 0 of the calendar and how a year is cut. A tick is one day. */
  calendar: { startYear: number; daysPerYear: number; monthsPerYear: number; eraName: string };
  physics: { gravity: "terrestre" | "faible" | "forte" | "variable"; ftl: boolean; notes: string };
  magic: { allowed: boolean; system: string; cost: string };
  technology: { maxLevel: number; allowed: string[]; forbidden: string[] };
  creatures: { fictional: boolean; deities: boolean; intelligentSpecies: boolean };
  npcs: { allowed: boolean };
  climate: Climate;
  geography: string;
  resources: string[];
  civilizations: string;
  fundamentalRules: FundamentalRule[];
  contribution: {
    /** closed: only creator/admins. proposals: contributors propose, a guardian validates. open: contributors write directly. */
    mode: "closed" | "proposals" | "open";
    guardianStrict: boolean;
  };
  /** True when the creator started from nothing: the map starts white. */
  blank: boolean;
};

/* -------------------------------------------------------------- entities */

export type PlaceKind =
  | "universe" | "galaxy" | "star_system" | "planet" | "continent"
  | "country" | "region" | "city" | "village" | "place";

export type BeingKind =
  | "character" | "npc" | "animal" | "creature" | "species" | "deity";

export type GroupKind =
  | "civilization" | "faction" | "dynasty" | "family" | "organization" | "religion";

export type ConceptKind = "language" | "technology" | "resource" | "item" | "quest";

export type EntityKind = PlaceKind | BeingKind | GroupKind | ConceptKind;

export type EntityStatus = "active" | "dead" | "destroyed" | "dissolved" | "completed" | "failed" | "archived";

export type Entity = {
  id: string;
  worldId: string;
  kind: EntityKind;
  name: string;
  summary: string;
  parentId: string | null;
  /** Map coordinates, 0–100, on the surface of the nearest planet ancestor. */
  x: number | null;
  y: number | null;
  status: EntityStatus;
  importance: number;
  data: Record<string, unknown>;
  imageUrl: string | null;
  bornTick: number | null;
  endedTick: number | null;
  /** Law keys this entity contradicts since the last constitutional change. */
  tensions: string[];
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RelationType =
  | "member_of" | "rules" | "ally" | "war" | "trade" | "rival" | "enemy"
  | "parent_of" | "spouse" | "friend" | "worships" | "speaks" | "owns" | "knows" | "serves" | "origin";

export type Relation = {
  id: string;
  worldId: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  data: Record<string, unknown>;
  sinceTick: number;
  untilTick: number | null;
};

export type EventKind =
  | "creation" | "narrative" | "law_change" | "correction" | "retcon"
  | "birth" | "death" | "war" | "peace" | "alliance" | "catastrophe" | "growth"
  | "decline" | "tech" | "migration" | "depletion" | "politics" | "quest" | "simulation";

export type TimelineEvent = {
  id: string;
  worldId: string;
  tick: number;
  title: string;
  description: string;
  kind: EventKind;
  entityIds: string[];
  consequences: string[];
  source: "creator" | "contributor" | "simulation" | "system";
  simulationId: string | null;
  /** False once superseded by a correction. Never deleted. */
  canon: boolean;
  supersededBy: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type ChangeType = "create" | "update" | "correction" | "retcon" | "simulation" | "law_change" | "status";

export type Revision = {
  id: string;
  worldId: string;
  targetType: "entity" | "constitution" | "event";
  targetId: string;
  version: number;
  changeType: ChangeType;
  before: unknown;
  after: unknown;
  reason: string;
  authorId: string | null;
  createdAt: string;
};

export type World = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: Visibility;
  constitution: Constitution;
  constitutionVersion: number;
  visualBible: Record<string, unknown>;
  /** Current day of the world since its start. */
  tick: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Member = {
  worldId: string;
  userId: string;
  displayName: string;
  role: Role;
  createdAt: string;
};

export type Invitation = {
  id: string;
  worldId: string;
  worldName?: string;
  email: string;
  role: Exclude<Role, "creator">;
  status: "pending" | "accepted" | "revoked";
  invitedBy: string;
  createdAt: string;
};

export type ProposalAction = "create" | "update" | "law_change";

export type Proposal = {
  id: string;
  worldId: string;
  authorId: string;
  authorName: string;
  action: ProposalAction;
  targetId: string | null;
  payload: Record<string, unknown>;
  guardian: GuardianReport | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reviewNote: string;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type Activity = {
  id: string;
  worldId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  worldId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/* -------------------------------------------------------------- guardian */

export type Verdict = "VALID" | "WARNING" | "CONFLICT";

export type GuardianIssue = {
  severity: "WARNING" | "CONFLICT";
  code: string;
  message: string;
  /** Which law or fact it collides with, in the creator's own words. */
  reference?: string;
  suggestion?: string;
};

export type GuardianReport = {
  verdict: Verdict;
  issues: GuardianIssue[];
  consequences: string[];
  alternatives: string[];
  /** "rules" = deterministic engine only; "rules+ai" = AI added explanations on top. */
  engine: "rules" | "rules+ai";
  checkedAt: string;
};

/** A creation or modification submitted for validation. */
export type EntityDraft = {
  kind: EntityKind;
  name: string;
  summary: string;
  parentId?: string | null;
  x?: number | null;
  y?: number | null;
  importance?: number;
  data?: Record<string, unknown>;
  bornTick?: number | null;
};

export type WorldState = {
  world: World;
  entities: Entity[];
  relations: Relation[];
  events: TimelineEvent[];
  members: Member[];
};
