/**
 * Rule-based idea structuring, used when no AI provider is configured (or
 * the quota is exhausted). It is presented in the UI as "suggestions
 * automatiques", never as AI output.
 */
import type { ProjectCategory } from "@/lib/constants";
import type { IdeaStructure } from "@/lib/ai/schemas";

type Rule = { category: ProjectCategory; keywords: string[]; skills: string[]; steps: string[]; resources: string[] };

const RULES: Rule[] = [
  {
    category: "event",
    keywords: ["festival", "soiree", "soirée", "concert", "tournoi", "evenement", "événement", "fete", "fête", "salon", "gala", "chateau", "château"],
    skills: ["Organisation", "Communication", "Logistique", "Partenariats", "Photographie"],
    steps: ["Valider l'intérêt de la communauté", "Choisir un lieu et vérifier les autorisations", "Construire le budget et trouver des partenaires", "Organiser la logistique et la sécurité", "Lancer la communication"],
    resources: ["Lieu", "Autorisations", "Assurance", "Matériel son et lumière", "Bénévoles"],
  },
  {
    category: "business",
    keywords: ["entreprise", "startup", "start-up", "societe", "société", "associe", "associé", "business", "commerce", "boutique", "application", "saas", "restaurant"],
    skills: ["Gestion de projet", "Marketing", "Finance", "Développement web", "Vente"],
    steps: ["Valider le besoin avec de futurs clients", "Définir l'offre et le modèle économique", "Constituer l'équipe fondatrice", "Construire une première version", "Trouver les premiers clients"],
    resources: ["Étude de marché", "Statut juridique", "Budget de lancement", "Outils numériques"],
  },
  {
    category: "creation",
    keywords: ["marque", "vetement", "vêtement", "film", "court-metrage", "court-métrage", "jeu video", "jeu vidéo", "album", "livre", "invention", "art", "collection", "podcast", "bd"],
    skills: ["Design", "Communication", "Photographie", "Vidéo", "Marketing"],
    steps: ["Définir la vision et l'identité", "Réaliser un premier prototype", "Constituer l'équipe créative", "Produire", "Présenter et diffuser"],
    resources: ["Matériel de création", "Budget de production", "Espace de travail"],
  },
  {
    category: "people",
    keywords: ["voyage", "voyager", "rencontre", "equipe sportive", "équipe sportive", "club", "communaute", "communauté", "randonnee", "randonnée", "colocation", "groupe", "sport"],
    skills: ["Organisation", "Communication", "Animation de communauté"],
    steps: ["Préciser l'activité et le rythme", "Réunir les premiers membres", "Fixer une première date", "Organiser la première rencontre"],
    resources: ["Lieu de rencontre", "Calendrier commun", "Budget partagé"],
  },
  {
    category: "opportunity",
    keywords: ["mission", "freelance", "partenariat", "collaboration", "appel", "recrute", "recrutement", "stage"],
    skills: ["Communication", "Gestion de projet"],
    steps: ["Décrire précisément le besoin", "Fixer les conditions", "Sélectionner les candidatures", "Démarrer la collaboration"],
    resources: ["Cahier des charges", "Budget"],
  },
];

const SKILL_KEYWORDS: [RegExp, string][] = [
  [/\bdj\b/i, "DJ"],
  [/photo/i, "Photographie"],
  [/vid[eé]o|film|tournage/i, "Vidéo"],
  [/design|graphi/i, "Design"],
  [/site|web|application|app\b|d[ée]velopp/i, "Développement web"],
  [/marketing|communication|r[ée]seaux sociaux/i, "Marketing"],
  [/musique|compos/i, "Musique"],
  [/couture|textile|v[êe]tement/i, "Couture"],
  [/financ|budget|levée/i, "Finance"],
  [/pixel|jeu vid[ée]o|game/i, "Game design"],
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function structureIdeaHeuristically(idea: string): IdeaStructure {
  const text = idea.trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  const scored = RULES.map((r) => ({ r, hits: r.keywords.filter((k) => lower.includes(k)).length })).sort((a, b) => b.hits - a.hits);
  const rule = scored[0] && scored[0].hits > 0 ? scored[0].r : RULES[1]!;

  const detected = SKILL_KEYWORDS.filter(([re]) => re.test(text)).map(([, s]) => s);
  const skills = Array.from(new Set([...detected, ...rule.skills])).slice(0, 6);

  // Title: strip the "j'aimerais / je veux" preamble and keep it short.
  let title = text
    .replace(/^(j['’]aimerais|je voudrais|je veux|je souhaite|j['’]ai envie de|on pourrait|et si on)\s+/i, "")
    .replace(/\s+(avec d['’]autres personnes|à plusieurs|ensemble)\.?$/i, "")
    .replace(/[.!?]+$/, "");
  if (title.length > 90) title = title.slice(0, 87).replace(/\s+\S*$/, "") + "…";
  title = capitalize(title.length >= 4 ? title : `Projet : ${text}`);

  return {
    title,
    description: text.length >= 30 ? capitalize(text) : `${capitalize(text)}. Je cherche des personnes motivées pour le concrétiser ensemble.`,
    category: rule.category,
    skills_needed: skills,
    first_steps: rule.steps,
    resources_needed: rule.resources,
    goal: rule.category === "event" ? "Réunir suffisamment de personnes intéressées" : "Constituer une équipe et lancer le projet",
    interest_goal: rule.category === "event" ? 200 : null,
    budget_estimate_eur: null,
    budget_note: null,
  };
}
