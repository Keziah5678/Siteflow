import { describe, expect, it } from "vitest";
import { WorldBrain } from "@/lib/engine/brain";
import { can, canChangeRole } from "@/lib/engine/permissions";
import { canNest } from "@/lib/engine/hierarchy";
import { entity, rel, state, world } from "./fixtures";

describe("World Brain", () => {
  const w = world();
  const realm = entity("civilization", "Royaume d'Aerion", { summary: "Un royaume de glace et de pierre." });
  const city = entity("city", "Hautemarche", { parentId: null });
  const king = entity("character", "Aldric", { summary: "Roi vieillissant", parentId: city.id });
  const rival = entity("civilization", "Clans du Givre");
  const s = state(w, [realm, city, king, rival], [rel(king, realm, "rules"), rel(realm, rival, "war")]);
  const brain = new WorldBrain(s);

  it("retrieves the facts about a named entity", () => {
    const a = brain.ask("Qui est Aldric ?");
    expect(a.facts[0].entityIds).toContain(king.id);
    expect(a.answer).toMatch(/Aldric/);
  });

  it("explains how two entities are related", () => {
    const steps = brain.path(king.id, rival.id);
    expect(steps).toEqual(["Aldric gouverne Royaume d'Aerion", "Royaume d'Aerion est en guerre contre Clans du Givre"]);
    expect(brain.ask("Quel lien entre Aldric et Clans du Givre ?").paths).toHaveLength(1);
  });

  it("answers law questions from the constitution", () => {
    expect(brain.ask("La magie est-elle autorisée ?").facts[0].text).toMatch(/magie n'existe pas/);
  });

  it("builds a dossier with hierarchy and relations", () => {
    const d = brain.dossier(king.id)!;
    expect(d.path.map(p => p.name)).toEqual(["Hautemarche", "Aldric"]);
    expect(d.relations[0].text).toMatch(/gouverne/);
  });
});

describe("permissions & hierarchy", () => {
  it("matches the role matrix", () => {
    const open = { contribution: { mode: "open" as const, guardianStrict: true } };
    const proposals = { contribution: { mode: "proposals" as const, guardianStrict: true } };
    expect(can("reader", "propose", proposals)).toBe(false);
    expect(can("contributor", "propose", proposals)).toBe(true);
    expect(can("contributor", "write", proposals)).toBe(false);
    expect(can("contributor", "write", open)).toBe(true);
    expect(can("guardian", "review")).toBe(true);
    expect(can("admin", "amend_laws")).toBe(false);
    expect(can("creator", "amend_laws")).toBe(true);
    expect(canChangeRole("admin", "contributor", "guardian")).toBe(true);
    expect(canChangeRole("admin", "contributor", "admin")).toBe(false);
    expect(canChangeRole("creator", "admin", "creator")).toBe(false);
  });
  it("only nests places downward", () => {
    expect(canNest("planet", "city")).toBe(true);
    expect(canNest("city", "planet")).toBe(false);
    expect(canNest("city", "character")).toBe(true);
  });
});
