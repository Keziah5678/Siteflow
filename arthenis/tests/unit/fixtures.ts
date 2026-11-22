import { defaultConstitution } from "@/lib/engine/constitution";
import type { Constitution, Entity, EntityKind, Relation, World, WorldState } from "@/lib/engine/types";

let n = 0;
export function uid() {
  n++;
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export function world(c: Partial<Constitution> = {}, tick = 3600): World {
  const now = new Date(0).toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111", ownerId: "u1", name: "Aerion", description: "Royaume des glaces",
    visibility: "private", constitution: { ...defaultConstitution("medieval"), ...c }, constitutionVersion: 1,
    visualBible: {}, tick, coverUrl: null, createdAt: now, updatedAt: now
  };
}

export function entity(kind: EntityKind, name: string, extra: Partial<Entity> = {}): Entity {
  const now = new Date(0).toISOString();
  return {
    id: uid(), worldId: "11111111-1111-4111-8111-111111111111", kind, name, summary: "", parentId: null,
    x: 50, y: 50, status: "active", importance: 3, data: {}, imageUrl: null, bornTick: null, endedTick: null,
    tensions: [], version: 1, createdBy: "u1", createdAt: now, updatedAt: now, ...extra
  };
}

export function rel(a: Entity, b: Entity, type: Relation["type"], sinceTick = 0): Relation {
  return { id: uid(), worldId: a.worldId, sourceId: a.id, targetId: b.id, type, data: {}, sinceTick, untilTick: null };
}

export function state(w: World, entities: Entity[] = [], relations: Relation[] = []): WorldState {
  return { world: w, entities, relations, events: [], members: [] };
}
