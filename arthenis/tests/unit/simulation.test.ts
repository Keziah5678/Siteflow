import { describe, expect, it } from "vitest";
import { durationToTicks, simulate } from "@/lib/engine/simulation";
import { entity, rel, state, world } from "./fixtures";

function aerion() {
  const w = world();
  const civA = entity("civilization", "Royaume d'Aerion", { x: 40, y: 40, data: { population: 50000, techLevel: 2, stability: 0.6 } });
  const civB = entity("civilization", "Clans du Givre", { x: 55, y: 45, data: { population: 20000, techLevel: 1, stability: 0.5 } });
  const city = entity("city", "Hautemarche", { x: 41, y: 41, data: { population: 9000, civilizationId: civA.id } });
  const village = entity("village", "Brumeval", { x: 45, y: 38, data: { population: 300, civilizationId: civA.id } });
  const king = entity("character", "Roi Aldric", { bornTick: w.tick - 60 * 360, data: {} });
  const ore = entity("resource", "Mine d'argent", { x: 42, y: 42, data: { abundance: 0.4, renewable: false, capacity: 400 } });
  const ents = [civA, civB, city, village, king, ore];
  return { w, s: state(w, ents, [rel(king, civA, "rules")]), civA, king, ore };
}

describe("Time Engine", () => {
  it("is deterministic: same world, same duration, same history", () => {
    const { s } = aerion();
    const now = "2026-01-01T00:00:00.000Z";
    const a = simulate(s, 360 * 50, { now });
    const b = simulate(s, 360 * 50, { now });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.toTick).toBe(s.world.tick + 360 * 50);
  });

  it("ages characters and eventually kills them, with a timeline entry", () => {
    const { s, king } = aerion();
    const r = simulate(s, 360 * 100);
    const change = r.changes.find(c => c.id === king.id);
    expect(change?.after.status).toBe("dead");
    expect(r.events.some(e => e.kind === "death" && e.entityIds.includes(king.id))).toBe(true);
  });

  it("never pushes technology beyond the constitutional cap", () => {
    const { s } = aerion();
    const r = simulate(s, 360 * 300);
    for (const c of r.changes) if (typeof c.after.data?.techLevel === "number") expect(c.after.data.techLevel as number).toBeLessThanOrEqual(s.world.constitution.technology.maxLevel);
  });

  it("consumes non-renewable resources and records depletion", () => {
    const { s, ore } = aerion();
    const r = simulate(s, 360 * 40);
    expect(r.changes.find(c => c.id === ore.id)?.after.data?.depleted).toBe(true);
    expect(r.events.some(e => e.kind === "depletion")).toBe(true);
  });

  it("produces something even for a single quiet day", () => {
    const w = world();
    const r = simulate(state(w, []), 1);
    expect(r.events).toHaveLength(1);
    expect(r.toTick).toBe(w.tick + 1);
  });

  it("converts durations with the world calendar", () => {
    const c = world().constitution;
    expect(durationToTicks({ years: 1 }, c)).toBe(360);
    expect(durationToTicks({ months: 1 }, c)).toBe(30);
    expect(durationToTicks({ days: 1 }, c)).toBe(1);
  });

  it("respects the NPC law for births", () => {
    const { s } = aerion();
    s.world.constitution.npcs.allowed = false;
    expect(simulate(s, 360 * 100).newEntities).toHaveLength(0);
  });
});
