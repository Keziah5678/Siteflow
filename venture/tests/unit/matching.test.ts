import { describe, expect, it } from "vitest";
import { missingSkills, rankCandidates, scoreCandidate, scoreProjectForViewer, tagsMatch, type MatchCandidate, type MatchProject } from "@/lib/matching";

const project: MatchProject = {
  title: "Créer une marque de vêtements",
  description: "Une marque de mode upcyclée avec une équipe passionnée.",
  category: "creation",
  skills_needed: ["Design", "Développement web", "Marketing", "Photographie"],
  is_remote: false,
  has_location: true,
};

const base: MatchCandidate = {
  id: "1", display_name: "A", username: "a", avatar_url: null, bio: "", skills: [], interests: [], ambitions: [], city: null,
  availability: "few_hours", experience: "intermediate", completed_projects_count: 0, distance_km: null, is_interested: false, has_applied: false,
};

describe("tagsMatch", () => {
  it("matches accents, case and plural forms", () => {
    expect(tagsMatch("Photographe", "photographes")).toBe(true);
    expect(tagsMatch("developpement web", "Développement Web")).toBe(true);
    expect(tagsMatch("DJ", "Design")).toBe(false);
  });
  it("does not match on tiny substrings", () => {
    expect(tagsMatch("art", "marketing")).toBe(false);
  });
});

describe("scoreCandidate", () => {
  it("rewards matching skills and explains why", () => {
    const r = scoreCandidate(project, { ...base, skills: ["Design", "Photographie"] });
    expect(r.matchedSkills).toEqual(["Design", "Photographie"]);
    expect(r.reasons[0]).toContain("Design");
    expect(r.score).toBeGreaterThan(30);
  });
  it("uses proximity only for physical projects", () => {
    const near = scoreCandidate(project, { ...base, skills: ["Design"], distance_km: 5, city: "Lyon" });
    const remote = scoreCandidate({ ...project, is_remote: true }, { ...base, skills: ["Design"], distance_km: 5, city: "Lyon" });
    expect(near.score).toBeGreaterThan(remote.score);
    expect(near.reasons.some((x) => x.includes("proximité"))).toBe(true);
  });
  it("caps the score at 100", () => {
    const r = scoreCandidate(project, { ...base, skills: project.skills_needed, interests: ["Mode", "Design"], is_interested: true, availability: "full_time", experience: "expert", completed_projects_count: 10, distance_km: 1 });
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("rankCandidates", () => {
  it("drops candidates without any concrete signal (no padding)", () => {
    const res = rankCandidates(project, [
      { ...base, id: "x", skills: ["Comptabilité"], availability: "full_time", experience: "expert" },
      { ...base, id: "y", skills: ["Marketing"] },
    ]);
    expect(res.map((r) => r.candidate.id)).toEqual(["y"]);
  });
  it("ranks the strongest match first", () => {
    const res = rankCandidates(project, [
      { ...base, id: "weak", skills: ["Marketing"] },
      { ...base, id: "strong", skills: ["Design", "Marketing", "Photographie"] },
    ]);
    expect(res[0]!.candidate.id).toBe("strong");
  });
});

describe("missingSkills", () => {
  it("lists needs not covered by the team", () => {
    expect(missingSkills(["DJ", "Photographes", "Partenaires"], ["photographie", "Organisation"])).toEqual(["DJ", "Partenaires"]);
  });
});

describe("scoreProjectForViewer", () => {
  it("prefers projects that need the viewer's skills", () => {
    const now = new Date().toISOString();
    const viewer = { skills: ["DJ"], interests: [], ambitions: [] };
    const a = scoreProjectForViewer(viewer, { id: "a", title: "Festival", description: "Musique", category: "event", skills_needed: ["DJ"], created_at: now, interest_count: 0 });
    const b = scoreProjectForViewer(viewer, { id: "b", title: "Startup", description: "SaaS", category: "business", skills_needed: ["Finance"], created_at: now, interest_count: 0 });
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.reason).toContain("DJ");
  });
});

describe("stemming", () => {
  it("matches the spec's skill vocabulary", () => {
    expect(tagsMatch("Organisateurs", "Organisation")).toBe(true);
    expect(tagsMatch("Designer", "Design")).toBe(true);
    expect(tagsMatch("Photographes", "Photographie")).toBe(true);
    expect(tagsMatch("Partenaires", "Photographie")).toBe(false);
  });
});
