import { z } from "zod";

export const CATEGORY_VALUES = ["business", "event", "people", "creation", "opportunity"] as const;

export const IdeaStructureSchema = z.object({
  title: z.string().describe("Titre court et motivant, 4 à 90 caractères"),
  description: z.string().describe("Description claire en 2 à 4 phrases, à la première personne"),
  category: z.enum(CATEGORY_VALUES),
  skills_needed: z.array(z.string()).describe("3 à 6 compétences recherchées, noms courts"),
  first_steps: z.array(z.string()).describe("3 à 6 premières étapes concrètes, dans l'ordre"),
  resources_needed: z.array(z.string()).describe("Ressources matérielles ou financières nécessaires"),
  goal: z.string().describe("Objectif recherché, une phrase"),
  interest_goal: z.number().int().nullable().describe("Nombre de personnes intéressées visé, si pertinent, sinon null"),
  budget_estimate_eur: z.number().nullable().describe("Budget estimatif en euros si estimable, sinon null"),
  budget_note: z.string().nullable().describe("Hypothèses du budget, ou null"),
});
export type IdeaStructure = z.infer<typeof IdeaStructureSchema>;

export const RoadmapSchema = z.object({
  summary: z.string(),
  milestones: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      tasks: z.array(z.string()),
      suggested_weeks_from_now: z.number().int().nullable(),
    }),
  ),
  risks: z.array(z.string()),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

export const NextActionsSchema = z.object({
  progress_analysis: z.string().describe("Analyse factuelle de l'avancement, fondée uniquement sur les données fournies"),
  next_actions: z.array(z.object({ action: z.string(), why: z.string(), owner_hint: z.string().nullable() })),
  missing_resources: z.array(z.string()),
  blockers: z.array(z.string()),
});
export type NextActions = z.infer<typeof NextActionsSchema>;

export const CostEstimateSchema = z.object({
  currency: z.literal("EUR"),
  items: z.array(z.object({ label: z.string(), low_eur: z.number(), high_eur: z.number(), note: z.string().nullable() })),
  total_low_eur: z.number(),
  total_high_eur: z.number(),
  assumptions: z.array(z.string()),
  disclaimer: z.string(),
});
export type CostEstimate = z.infer<typeof CostEstimateSchema>;

export const BusinessPlanSchema = z.object({
  executive_summary: z.string(),
  problem: z.string(),
  solution: z.string(),
  target_customers: z.string(),
  value_proposition: z.string(),
  business_model: z.string(),
  go_to_market: z.array(z.string()),
  team_needs: z.array(z.string()),
  key_metrics: z.array(z.string()),
  risks: z.array(z.string()),
  next_steps: z.array(z.string()),
});
export type BusinessPlan = z.infer<typeof BusinessPlanSchema>;

export const EventPlanSchema = z.object({
  format: z.string(),
  checklist: z.array(z.object({ phase: z.string(), items: z.array(z.string()) })),
  permits_and_safety: z.array(z.string()),
  partner_types: z.array(z.string()),
  pricing_advice: z.string(),
  disclaimer: z.string(),
});
export type EventPlan = z.infer<typeof EventPlanSchema>;

export const PartnersSchema = z.object({
  partner_types: z.array(z.object({ type: z.string(), why: z.string(), how_to_approach: z.string() })),
  matching_opportunity_ids: z.array(z.string()).describe("Uniquement des identifiants présents dans la liste fournie"),
  outreach_message_template: z.string(),
});
export type Partners = z.infer<typeof PartnersSchema>;

export const PeopleRecommendationSchema = z.object({
  recommendations: z.array(z.object({ user_id: z.string(), role_for_project: z.string(), explanation: z.string() })),
  uncovered_needs: z.array(z.string()),
});
export type PeopleRecommendation = z.infer<typeof PeopleRecommendationSchema>;

export const AI_FEATURES = {
  structure_idea: { credits: 1, label: "Structurer une idée" },
  roadmap: { credits: 2, label: "Feuille de route" },
  next_actions: { credits: 1, label: "Analyse et prochaines actions" },
  cost_estimate: { credits: 2, label: "Estimation des coûts" },
  business_plan: { credits: 5, label: "Business plan" },
  event_plan: { credits: 3, label: "Organisation d'événement" },
  partners: { credits: 2, label: "Trouver des partenaires" },
  recommend_people: { credits: 2, label: "Profils compatibles" },
} as const;
export type AIFeature = keyof typeof AI_FEATURES;
