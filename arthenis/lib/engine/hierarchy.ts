import type { Entity, EntityKind, PlaceKind } from "./types";

/**
 * Scales of a world: Univers → Galaxies → Systèmes → Planètes → Continents →
 * Pays → Régions → Villes → Villages → Lieux. A world may skip any of them;
 * a child must simply sit strictly below its parent.
 */
export const PLACE_LEVELS: PlaceKind[] = [
  "universe", "galaxy", "star_system", "planet", "continent",
  "country", "region", "city", "village", "place"
];

export const KIND_LABEL: Record<EntityKind, string> = {
  universe: "Univers", galaxy: "Galaxie", star_system: "Système stellaire", planet: "Planète",
  continent: "Continent", country: "Pays", region: "Région", city: "Ville", village: "Village", place: "Lieu",
  character: "Personnage", npc: "PNJ", animal: "Animal", creature: "Créature", species: "Espèce",
  deity: "Divinité", civilization: "Civilisation", faction: "Faction", dynasty: "Dynastie",
  family: "Famille", organization: "Organisation", religion: "Religion", language: "Langue",
  technology: "Technologie", resource: "Ressource", item: "Objet", quest: "Quête"
};

export const KIND_ICON: Record<EntityKind, string> = {
  universe: "✺", galaxy: "🌌", star_system: "☀", planet: "◍", continent: "⛰", country: "⚑",
  region: "◈", city: "🏰", village: "⌂", place: "✦", character: "♛", npc: "☺", animal: "🐾",
  creature: "🐉", species: "🧬", deity: "☼", civilization: "⚜", faction: "⚔", dynasty: "♔",
  family: "❦", organization: "⚙", religion: "☥", language: "✎", technology: "⚗", resource: "◆",
  item: "🗝", quest: "✧"
};

export const BEING_KINDS: EntityKind[] = ["character", "npc", "animal", "creature", "species", "deity"];
export const GROUP_KINDS: EntityKind[] = ["civilization", "faction", "dynasty", "family", "organization", "religion"];
export const CONCEPT_KINDS: EntityKind[] = ["language", "technology", "resource", "item", "quest"];
export const ALL_KINDS: EntityKind[] = [...PLACE_LEVELS, ...BEING_KINDS, ...GROUP_KINDS, ...CONCEPT_KINDS];

export function isPlace(kind: EntityKind): kind is PlaceKind {
  return (PLACE_LEVELS as string[]).includes(kind);
}

export function placeLevel(kind: EntityKind): number {
  return PLACE_LEVELS.indexOf(kind as PlaceKind);
}

/** Cosmic places are shown in the space view, not on a planet surface. */
export function isCosmic(kind: EntityKind): boolean {
  return kind === "universe" || kind === "galaxy" || kind === "star_system";
}

/** Whether `child` may be placed under `parent`. Non-places may live under any place. */
export function canNest(parent: EntityKind, child: EntityKind): boolean {
  if (isPlace(child)) return isPlace(parent) && placeLevel(child) > placeLevel(parent);
  if (child === "character" || child === "npc" || child === "animal" || child === "creature") {
    return isPlace(parent) || parent === "civilization" || parent === "faction" || parent === "family" || parent === "dynasty" || parent === "organization";
  }
  return true;
}

export function ancestors(entity: Entity, byId: Map<string, Entity>): Entity[] {
  const out: Entity[] = [];
  const seen = new Set<string>();
  let cur = entity.parentId ? byId.get(entity.parentId) : undefined;
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

/** Planet an entity stands on, or null for the world's default surface. */
export function planetOf(entity: Entity, byId: Map<string, Entity>): string | null {
  if (entity.kind === "planet") return entity.id;
  const p = ancestors(entity, byId).find(a => a.kind === "planet");
  return p ? p.id : null;
}

/** Breadcrumb from the root to the entity. */
export function pathOf(entity: Entity, byId: Map<string, Entity>): Entity[] {
  return [...ancestors(entity, byId).reverse(), entity];
}

/** The map level at which a kind becomes legible (0 = whole surface). */
export const MAP_MIN_LEVEL: Partial<Record<EntityKind, number>> = {
  continent: 0, country: 0, civilization: 0, region: 1, city: 1, resource: 2,
  village: 2, place: 3, character: 3, npc: 3, animal: 3, creature: 3, quest: 2, item: 4, deity: 1
};

/** Would creating `childKind` under this hierarchy cycle? (used on re-parenting) */
export function wouldCycle(entityId: string, newParentId: string | null, byId: Map<string, Entity>): boolean {
  let cur = newParentId ? byId.get(newParentId) : undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.id === entityId) return true;
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return false;
}
