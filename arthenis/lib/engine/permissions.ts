import type { Constitution, Member, Role, World } from "./types";

/**
 * Capabilities by role. The same matrix is enforced in SQL by the RLS helper
 * `world_role_rank()` (see supabase/migrations). This file is what the UI and
 * the local repository use; the database is the real security boundary.
 */
export type Capability =
  | "read" | "propose" | "write" | "review" | "simulate"
  | "amend_laws" | "manage_members" | "manage_world" | "generate_images";

export const ROLE_RANK: Record<Role, number> = {
  reader: 1, contributor: 2, guardian: 3, admin: 4, creator: 5
};

export const ROLE_LABEL: Record<Role, string> = {
  creator: "Créateur", admin: "Administrateur", guardian: "Gardien", contributor: "Contributeur", reader: "Lecteur"
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  creator: "Autorité suprême du monde. Seul à pouvoir modifier la constitution.",
  admin: "Gère les membres, valide et écrit directement, fait avancer le temps.",
  guardian: "Valide ou rejette les propositions, écrit directement.",
  contributor: "Propose des créations. Selon les règles du monde, écrit directement ou soumet à validation.",
  reader: "Explore le monde sans le modifier."
};

const MIN_RANK: Record<Capability, number> = {
  read: 1,
  propose: 2,
  write: 3,          // contributors get it only in "open" worlds, see below
  review: 3,
  generate_images: 2,
  simulate: 4,
  manage_members: 4,
  amend_laws: 5,
  manage_world: 5
};

export function can(role: Role | null | undefined, cap: Capability, constitution?: Pick<Constitution, "contribution">): boolean {
  if (!role) return false;
  const rank = ROLE_RANK[role];
  if (cap === "write" && role === "contributor") return constitution?.contribution.mode === "open";
  if (cap === "propose" && role === "contributor") return constitution?.contribution.mode !== "closed";
  return rank >= MIN_RANK[cap];
}

export function roleOf(world: World | null | undefined, members: Member[], userId: string | null | undefined): Role | null {
  if (!world || !userId) return null;
  if (world.ownerId === userId) return "creator";
  return members.find(m => m.userId === userId)?.role ?? (world.visibility === "public" ? "reader" : null);
}

/** Only a strictly higher rank may change someone's role, and nobody can touch the creator. */
export function canChangeRole(actor: Role, target: Role, next: Role): boolean {
  if (target === "creator" || next === "creator") return false;
  if (!can(actor, "manage_members")) return false;
  return ROLE_RANK[actor] > ROLE_RANK[target] && ROLE_RANK[actor] > ROLE_RANK[next];
}
