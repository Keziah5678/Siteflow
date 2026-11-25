import { describe, expect, it } from "vitest";
import { structureIdeaHeuristically } from "@/lib/heuristics";
import { IdeaStructureSchema } from "@/lib/ai/schemas";

describe("structureIdeaHeuristically", () => {
  it("structures the spec example into a creation project", () => {
    const r = structureIdeaHeuristically("J'aimerais créer une marque de vêtements avec d'autres personnes.");
    expect(r.category).toBe("creation");
    expect(r.title).toBe("Créer une marque de vêtements");
    expect(r.skills_needed).toContain("Couture");
    expect(r.first_steps.length).toBeGreaterThanOrEqual(3);
    expect(IdeaStructureSchema.safeParse(r).success).toBe(true);
  });
  it("detects events and sets an interest goal", () => {
    const r = structureIdeaHeuristically("Organiser une soirée dans un château pour 500 personnes");
    expect(r.category).toBe("event");
    expect(r.interest_goal).not.toBeNull();
  });
  it("never invents a budget", () => {
    expect(structureIdeaHeuristically("Lancer une startup de livraison à vélo").budget_estimate_eur).toBeNull();
  });
  it("detects DJ skill", () => {
    expect(structureIdeaHeuristically("Un festival électro, il nous faut un DJ").skills_needed).toContain("DJ");
  });
});
