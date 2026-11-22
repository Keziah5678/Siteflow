import { describe, expect, it } from "vitest";
import { analyzeLawChange, checkDraft, mergeAiReview } from "@/lib/engine/guardian";
import { defaultConstitution } from "@/lib/engine/constitution";
import { mentions, norm } from "@/lib/engine/text";
import { entity, world } from "./fixtures";

const ctx = (c = world().constitution, entities = [] as ReturnType<typeof entity>[]) => ({ constitution: c, entities, tick: 3600, events: [] });

describe("text matching", () => {
  it("ignores negated mentions and substrings", () => {
    expect(mentions(norm("Un monde sans magie"), "magie")).toBe(false);
    expect(mentions(norm("Une image du fromage"), "mage")).toBe(false);
    expect(mentions(norm("Les sorcières du nord"), "sorciere")).toBe(true);
  });
});

describe("Guardian", () => {
  it("returns VALID for a coherent medieval village", () => {
    const r = checkDraft({ kind: "village", name: "Brumeval", summary: "Un village de bûcherons au bord du lac." }, ctx());
    expect(r.verdict).toBe("VALID");
    expect(r.consequences.length).toBeGreaterThan(0);
  });

  it("CONFLICT for a sorcerer in a world without magic, with an alternative", () => {
    const r = checkDraft({ kind: "character", name: "Malvor", summary: "Un sorcier qui lance des boules de feu." }, ctx());
    expect(r.verdict).toBe("CONFLICT");
    expect(r.issues[0].code).toBe("magic_forbidden");
    expect(r.issues[0].reference).toMatch(/magie n'existe pas/);
    expect(r.alternatives[0]).toMatch(/érudit|alchimiste/);
  });

  it("accepts the same sorcerer once the creator allows magic", () => {
    const c = { ...defaultConstitution("medieval"), magic: { allowed: true, system: "runes", cost: "sang" } };
    expect(checkDraft({ kind: "character", name: "Malvor", summary: "Un sorcier." }, ctx(c)).verdict).toBe("VALID");
  });

  it("flags anachronistic technology: WARNING for one step, CONFLICT beyond", () => {
    const warn = checkDraft({ kind: "item", name: "Bombarde", summary: "Un canon de bronze." }, ctx());
    expect(warn.verdict).toBe("WARNING");
    const conflict = checkDraft({ kind: "item", name: "Lame", summary: "Un sabre laser." }, ctx());
    expect(conflict.verdict).toBe("CONFLICT");
    expect(conflict.issues[0].suggestion).toMatch(/épée|arbalète/);
  });

  it("strict realism makes even a small anachronism a CONFLICT", () => {
    const c = { ...defaultConstitution("medieval"), realism: "strict" as const };
    expect(checkDraft({ kind: "item", name: "Bombarde", summary: "Un canon." }, ctx(c)).verdict).toBe("CONFLICT");
  });

  it("forbids fictional creatures, deities and NPCs according to the laws", () => {
    expect(checkDraft({ kind: "animal", name: "Ombre", summary: "Un dragon des glaces" }, ctx()).verdict).toBe("CONFLICT");
    expect(checkDraft({ kind: "deity", name: "Solenne", summary: "Déesse du soleil" }, ctx()).issues.some(i => i.code === "deity_forbidden")).toBe(true);
    const noNpc = { ...defaultConstitution("medieval"), npcs: { allowed: false } };
    expect(checkDraft({ kind: "npc", name: "Garde", summary: "" }, ctx(noNpc)).verdict).toBe("CONFLICT");
  });

  it("enforces the creator's fundamental rules", () => {
    const c = { ...defaultConstitution("fantastique"), fundamentalRules: [{ id: "r1", title: "Le ciel est vide", description: "Personne ne vole.", forbiddenTerms: ["voler", "vol"] }] };
    const r = checkDraft({ kind: "creature", name: "Aigle-roi", summary: "Il peut voler au-dessus des pics." }, ctx(c));
    expect(r.verdict).toBe("CONFLICT");
    expect(r.issues[0].message).toMatch(/Le ciel est vide/);
  });

  it("checks hierarchy, duplicates and references to the dead", () => {
    const city = entity("city", "Valcourt");
    const dead = entity("character", "Roi Aldric", { status: "dead", endedTick: 100 });
    const bad = checkDraft({ kind: "continent", name: "Nord", summary: "", parentId: city.id }, ctx(undefined, [city]));
    expect(bad.issues.some(i => i.code === "hierarchy")).toBe(true);
    const dup = checkDraft({ kind: "city", name: "valcourt", summary: "" }, ctx(undefined, [city]));
    expect(dup.verdict).toBe("WARNING");
    const ghost = checkDraft({ kind: "character", name: "Héraut", summary: "Il sert le roi Aldric chaque matin." }, ctx(undefined, [dead]));
    expect(ghost.issues.some(i => i.code === "references_ended")).toBe(true);
  });

  it("warns on lifespans beyond the species", () => {
    const r = checkDraft({ kind: "character", name: "Ancien", summary: "", data: { age: 180 } }, ctx());
    expect(r.issues.some(i => i.code === "age_lifespan")).toBe(true);
  });

  it("never lets the AI downgrade a CONFLICT, and only accepts AI conflicts citing a law", () => {
    const base = checkDraft({ kind: "character", name: "Malvor", summary: "Un sorcier." }, ctx());
    const merged = mergeAiReview(base, { issues: [{ severity: "CONFLICT", code: "invented", message: "Je n'aime pas" }] }, world().constitution);
    expect(merged.verdict).toBe("CONFLICT");
    expect(merged.issues.find(i => i.code === "ai:invented")?.severity).toBe("WARNING");
    expect(merged.engine).toBe("rules+ai");
  });

  it("analyses a law change without deleting anything", () => {
    const fantasy = { ...defaultConstitution("fantastique") };
    const mage = entity("character", "Ilyra", { summary: "Une mage des marées" });
    const knight = entity("character", "Bran", { summary: "Un chevalier" });
    const noMagic = { ...fantasy, magic: { allowed: false, system: "", cost: "" } };
    const impact = analyzeLawChange(fantasy, noMagic, { entities: [mage, knight], tick: 0 });
    expect(impact.newlyConflicting.map(x => x.name)).toEqual(["Ilyra"]);
    expect(impact.changes.some(c => c.includes("Magie"))).toBe(true);
  });
});
