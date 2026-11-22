import { placeholderFor } from "@/lib/world/placeholder";
import type { WorldVisualIdentity } from "@/lib/world/identity";
import type { EntityKind } from "@/lib/engine/types";

/** Maps v2 kinds onto the beta placeholder painter's subjects. */
const SUBJECT: Partial<Record<EntityKind, string>> = {
  character: "Personnage", npc: "Personnage", deity: "Personnage", dynasty: "Personnage", family: "Personnage",
  creature: "Créature", animal: "Créature", species: "Créature",
  civilization: "Civilisation", city: "Civilisation", country: "Civilisation", faction: "Civilisation", organization: "Civilisation", religion: "Influence",
  village: "Village", place: "Village", technology: "Influence", item: "Influence", quest: "Influence", language: "Influence"
};

export function artFor(identity: WorldVisualIdentity, e: { id: string; kind: EntityKind | "world"; name: string; summary?: string }): string {
  return placeholderFor(identity, { id: e.id, kind: e.kind === "world" ? "Région" : SUBJECT[e.kind] ?? "Région", name: e.name, description: e.summary ?? "" });
}
