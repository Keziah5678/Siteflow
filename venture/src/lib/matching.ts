/**
 * VENTURE matching — explainable, deterministic scoring.
 *
 * The score ranks *relevance* for a project; it is never presented as a
 * probability of success. Every point awarded produces a human-readable
 * reason so the UI can explain each recommendation.
 */
import type { Availability, Experience, ProjectCategory } from "@/lib/constants";

export type MatchCandidate = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  skills: string[];
  interests: string[];
  ambitions: string[];
  city: string | null;
  availability: Availability;
  experience: Experience;
  completed_projects_count: number;
  distance_km: number | null;
  is_interested: boolean;
  has_applied: boolean;
};

export type MatchProject = {
  title: string;
  description: string;
  category: ProjectCategory;
  skills_needed: string[];
  is_remote: boolean;
  has_location: boolean;
};

export type MatchResult = {
  candidate: MatchCandidate;
  score: number; // 0–100 relevance, not a guarantee
  matchedSkills: string[];
  reasons: string[];
};

export function normalizeTag(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

// Light French/English stemming so "Photographes" ≈ "Photographie",
// "Organisateurs" ≈ "Organisation", "Designer" ≈ "Design".
const SUFFIXES = ["ations", "ation", "ateurs", "ateur", "atrices", "atrice", "euses", "euse", "eurs", "eur", "istes", "iste", "ies", "ie", "ers", "er", "ing", "es", "e", "s"];
function stemWord(w: string): string {
  if (w.length <= 4) return w;
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
  }
  return w;
}
export function stemTag(s: string): string {
  return normalizeTag(s).split(" ").map(stemWord).join(" ");
}

/** Loose equality on stems: exact, or one contains the other (≥4 chars). */
export function tagsMatch(a: string, b: string): boolean {
  const x = stemTag(a);
  const y = stemTag(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.includes(short);
}

const CATEGORY_KEYWORDS: Record<ProjectCategory, string[]> = {
  business: ["entrepreneuriat", "startup", "business", "entreprise", "commerce", "innovation"],
  event: ["evenement", "festival", "musique", "soiree", "concert", "sport", "evenementiel"],
  people: ["voyage", "rencontre", "communaute", "sport", "randonnee", "association"],
  creation: ["art", "mode", "design", "cinema", "film", "jeu video", "musique", "creation", "invention"],
  opportunity: ["freelance", "mission", "collaboration", "partenariat"],
};

function words(text: string): Set<string> {
  return new Set(
    normalizeTag(text)
      .split(" ")
      .filter((w) => w.length >= 4),
  );
}

export function scoreCandidate(project: MatchProject, c: MatchCandidate): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // 1. Skills (up to 50)
  const matchedSkills = project.skills_needed.filter((need) => c.skills.some((s) => tagsMatch(s, need)));
  if (project.skills_needed.length > 0 && matchedSkills.length > 0) {
    score += Math.min(50, Math.round((matchedSkills.length / project.skills_needed.length) * 50) + 10);
    reasons.push(`Compétences recherchées : ${matchedSkills.join(", ")}`);
  }

  // 2. Interests & ambitions vs. project topic (up to 20)
  const topic = words(`${project.title} ${project.description}`);
  for (const k of CATEGORY_KEYWORDS[project.category]) topic.add(normalizeTag(k));
  const sharedInterests = [...c.interests, ...c.ambitions].filter((i) => {
    const iw = normalizeTag(i);
    return [...topic].some((t) => tagsMatch(t, iw));
  });
  if (sharedInterests.length > 0) {
    score += Math.min(20, 8 * sharedInterests.length);
    reasons.push(`Centres d'intérêt liés : ${sharedInterests.slice(0, 3).join(", ")}`);
  }

  // 3. Already expressed interest in this project (10)
  if (c.is_interested) {
    score += 10;
    reasons.push("A déjà manifesté son intérêt pour ce projet");
  }

  // 4. Availability (up to 8)
  const avail: Record<Availability, number> = { unavailable: 0, few_hours: 3, part_time: 6, full_time: 8 };
  score += avail[c.availability];
  if (c.availability === "part_time" || c.availability === "full_time") {
    reasons.push(c.availability === "full_time" ? "Disponible à temps plein" : "Disponible à temps partiel");
  }

  // 5. Proximity (up to 8) — only when the project is physical
  if (!project.is_remote && project.has_location && c.distance_km != null) {
    if (c.distance_km <= 15) {
      score += 8;
      reasons.push(c.city ? `À proximité (${c.city})` : "À proximité");
    } else if (c.distance_km <= 60) {
      score += 5;
      reasons.push(`À environ ${c.distance_km} km`);
    } else if (c.distance_km <= 200) {
      score += 2;
    }
  }

  // 6. Track record: completed projects & experience (up to 6)
  const exp: Record<Experience, number> = { beginner: 0, intermediate: 1, experienced: 2, expert: 3 };
  score += exp[c.experience] + Math.min(3, c.completed_projects_count);
  if (c.completed_projects_count > 0) {
    reasons.push(`${c.completed_projects_count} projet${c.completed_projects_count > 1 ? "s" : ""} réalisé${c.completed_projects_count > 1 ? "s" : ""} sur VENTURE`);
  }

  return { candidate: c, score: Math.min(100, score), matchedSkills, reasons };
}

/**
 * Ranks candidates. Candidates with no concrete signal (no skill, interest
 * or engagement match) are dropped: we never pad recommendations.
 */
export function rankCandidates(project: MatchProject, candidates: MatchCandidate[], limit = 12): MatchResult[] {
  return candidates
    .map((c) => scoreCandidate(project, c))
    .filter((r) => r.matchedSkills.length > 0 || r.candidate.is_interested || r.reasons.some((x) => x.startsWith("Centres")))
    .sort((a, b) => b.score - a.score || a.candidate.display_name.localeCompare(b.candidate.display_name))
    .slice(0, limit);
}

/** Missing skills: needed by the project and not covered by any team member. */
export function missingSkills(needed: string[], teamSkills: string[]): string[] {
  return needed.filter((n) => !teamSkills.some((s) => tagsMatch(s, n)));
}

// ---------------------------------------------------------------------------
// Feed personalisation ("Pour toi")
// ---------------------------------------------------------------------------
export type FeedViewer = { skills: string[]; interests: string[]; ambitions: string[] };
export type FeedProject = { id: string; title: string; description: string; category: ProjectCategory; skills_needed: string[]; created_at: string; interest_count: number };

export function scoreProjectForViewer(v: FeedViewer, p: FeedProject): { score: number; reason: string | null } {
  let score = 0;
  let reason: string | null = null;
  const skillHits = p.skills_needed.filter((need) => v.skills.some((s) => tagsMatch(s, need)));
  if (skillHits.length) {
    score += 40 + 10 * skillHits.length;
    reason = `Recherche ta compétence : ${skillHits[0]}`;
  }
  const topic = words(`${p.title} ${p.description}`);
  for (const k of CATEGORY_KEYWORDS[p.category]) topic.add(normalizeTag(k));
  const interestHit = [...v.interests, ...v.ambitions].find((i) => [...topic].some((t) => tagsMatch(t, i)));
  if (interestHit) {
    score += 25;
    reason ??= `Lié à ton intérêt : ${interestHit}`;
  }
  // Freshness (up to 15) and light social proof (up to 5).
  const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
  score += Math.max(0, 15 - ageDays);
  score += Math.min(5, Math.log10(1 + p.interest_count) * 2);
  return { score, reason };
}
