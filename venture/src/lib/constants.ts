import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];
export type ProjectCategory = E["project_category"];
export type ProjectStatus = E["project_status"];
export type EventStage = E["event_stage"];
export type Availability = E["availability"];
export type Experience = E["experience_level"];
export type OpportunityKind = E["opportunity_kind"];
export type PlatformRole = E["platform_role"];
export type PlanTier = E["plan_tier"];

export const CATEGORIES: { value: ProjectCategory; label: string; universe: string; hint: string }[] = [
  { value: "business", label: "Business", universe: "BUSINESS", hint: "Entreprise, associés, validation d'idée" },
  { value: "event", label: "Événement", universe: "EVENTS", hint: "Festival, soirée, tournoi, expérience collective" },
  { value: "people", label: "Rencontres", universe: "PEOPLE", hint: "Voyage, sport, communauté, activité à plusieurs" },
  { value: "creation", label: "Création", universe: "CREATION", hint: "Marque, film, jeu vidéo, invention, art" },
  { value: "opportunity", label: "Opportunité", universe: "OPPORTUNITIES", hint: "Mission, collaboration, appel à candidatures" },
];

export const CATEGORY_LABEL: Record<ProjectCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ProjectCategory, string>;

export const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "idea", label: "Idée" },
  { value: "recruiting", label: "Recherche de participants" },
  { value: "preparing", label: "Préparation" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Réalisé" },
  { value: "cancelled", label: "Annulé" },
];
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label])) as Record<ProjectStatus, string>;

export const EVENT_STAGES: { value: EventStage; label: string; description: string }[] = [
  { value: "proposed", label: "Événement proposé", description: "La communauté manifeste son intérêt. Rien n'est encore organisé." },
  { value: "preparing", label: "Événement en préparation", description: "Un organisateur travaille à sa concrétisation." },
  { value: "confirmed", label: "Événement confirmé", description: "Date et lieu confirmés par l'équipe." },
  { value: "cancelled", label: "Événement annulé", description: "L'événement n'aura pas lieu." },
];
export const EVENT_STAGE_LABEL = Object.fromEntries(EVENT_STAGES.map((s) => [s.value, s.label])) as Record<EventStage, string>;

export const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: "unavailable", label: "Pas disponible actuellement" },
  { value: "few_hours", label: "Quelques heures par semaine" },
  { value: "part_time", label: "Temps partiel" },
  { value: "full_time", label: "Temps plein" },
];
export const AVAILABILITY_LABEL = Object.fromEntries(AVAILABILITY.map((a) => [a.value, a.label])) as Record<Availability, string>;

export const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "experienced", label: "Expérimenté" },
  { value: "expert", label: "Expert" },
];
export const EXPERIENCE_LABEL = Object.fromEntries(EXPERIENCE.map((a) => [a.value, a.label])) as Record<Experience, string>;

export const OPPORTUNITY_KINDS: { value: OpportunityKind; label: string }[] = [
  { value: "mission", label: "Mission" },
  { value: "collaboration", label: "Collaboration" },
  { value: "call", label: "Appel à candidatures" },
  { value: "partnership", label: "Partenariat" },
  { value: "service", label: "Offre de service" },
];
export const OPPORTUNITY_KIND_LABEL = Object.fromEntries(OPPORTUNITY_KINDS.map((a) => [a.value, a.label])) as Record<OpportunityKind, string>;

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harcèlement" },
  { value: "inappropriate", label: "Contenu inapproprié" },
  { value: "scam", label: "Arnaque" },
  { value: "impersonation", label: "Usurpation d'identité" },
  { value: "other", label: "Autre" },
] as const;

export const FEED_FILTERS = [
  { value: "for_you", label: "Pour toi" },
  { value: "business", label: "Business" },
  { value: "event", label: "Événements" },
  { value: "people", label: "Rencontres" },
  { value: "creation", label: "Création" },
  { value: "opportunity", label: "Opportunités" },
  { value: "nearby", label: "À proximité" },
] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number]["value"];

export const SKILL_SUGGESTIONS = [
  "Design", "Développement web", "Marketing", "Photographie", "Vidéo", "Communication", "Organisation",
  "Finance", "Juridique", "Vente", "Graphisme", "Rédaction", "Musique", "DJ", "Logistique", "Partenariats",
  "Gestion de projet", "Couture", "Game design", "Pixel art", "Data", "Recherche de financement",
];

export const ADMIN_PERMISSIONS = {
  moderator: ["reports", "moderation", "suspend"],
  admin: ["reports", "moderation", "suspend", "users", "companies", "events", "plans", "settings", "stats", "ai", "payments"],
  superadmin: ["reports", "moderation", "suspend", "users", "companies", "events", "plans", "settings", "stats", "ai", "payments", "roles"],
} as const satisfies Record<Exclude<PlatformRole, "user">, readonly string[]>;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)["superadmin"][number];

export function can(role: PlatformRole | null | undefined, permission: AdminPermission): boolean {
  if (!role || role === "user") return false;
  return (ADMIN_PERMISSIONS[role] as readonly string[]).includes(permission);
}
