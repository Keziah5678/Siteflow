import { z } from "zod";
import { splitTags } from "@/lib/utils";

const tags = (max: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : splitTags(v)))
    .pipe(z.array(z.string().trim().min(1).max(40)).max(max, `${max} éléments maximum`));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^https?:\/\/[^\s]+$/i.test(v), "L'URL doit commencer par http:// ou https://")
  .transform((v) => v ?? null);

/** Optional number from forms: "", null and undefined become null (never 0). */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().pipe(schema).nullable()).optional().transform((v) => v ?? null);

export function isAdult(birthdate: string, now = new Date()): boolean {
  const d = new Date(birthdate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const limit = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return d <= limit;
}

export const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128)
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const signupSchema = z.object({
  display_name: z.string().trim().min(1, "Indique ton nom ou pseudonyme").max(60),
  email: z.string().trim().toLowerCase().email("Email invalide").max(254),
  password: passwordSchema,
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .refine((d) => d > "1900-01-01", "Date invalide")
    .refine((d) => isAdult(d), "VENTURE est réservé aux personnes majeures (18 ans et plus)."),
  terms: z.literal("on", { message: "Tu dois accepter les conditions d'utilisation" }),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(0, "bot").optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis").max(128),
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "3 à 24 caractères : lettres minuscules, chiffres, _"),
  bio: z.string().trim().max(600).default(""),
  skills: tags(25),
  interests: tags(25),
  ambitions: tags(10),
  city: optionalText(80),
  portfolio_url: optionalUrl,
  availability: z.enum(["unavailable", "few_hours", "part_time", "full_time"]),
  experience: z.enum(["beginner", "intermediate", "experienced", "expert"]),
});

export const privacySchema = z.object({
  visibility: z.enum(["public", "members"]),
  is_discoverable: z.boolean(),
  show_joined_projects: z.boolean(),
  share_location: z.boolean(),
  email_notifications: z.boolean(),
});

export const projectSchema = z.object({
  title: z.string().trim().min(4, "Titre trop court (4 caractères min.)").max(120),
  description: z.string().trim().min(10, "Description trop courte (10 caractères min.)").max(5000),
  category: z.enum(["business", "event", "people", "creation", "opportunity"]),
  status: z.enum(["idea", "recruiting", "preparing", "in_progress", "completed", "cancelled"]).default("recruiting"),
  goal: optionalText(200),
  interest_goal: optionalNumber(z.number().int().min(1).max(10_000_000)),
  skills_needed: tags(15),
  resources_needed: tags(15),
  budget_estimate_eur: optionalNumber(z.number().min(0).max(1_000_000_000)),
  city: optionalText(80),
  is_remote: z.boolean().default(false),
  cover_url: optionalUrl,
  first_steps: tags(12).optional(),
  // Event-specific (optional)
  venue_idea: optionalText(200),
  capacity: optionalNumber(z.number().int().min(1).max(1_000_000)),
  price_min_eur: optionalNumber(z.number().min(0).max(100_000)),
  price_max_eur: optionalNumber(z.number().min(0).max(100_000)),
  date_options: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(6).optional(),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const applicationSchema = z.object({
  project_id: z.string().uuid(),
  skill: optionalText(60),
  message: z.string().trim().min(10, "Présente-toi en quelques mots (10 caractères min.)").max(1500),
});

export const commentSchema = z.object({
  project_id: z.string().uuid(),
  body: z.string().trim().min(1, "Message vide").max(2000),
});

export const taskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(2, "Titre trop court").max(200),
  assignee_id: z.string().uuid().nullable().optional().catch(null),
  milestone_id: z.string().uuid().nullable().optional().catch(null),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null),
});

export const milestoneSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(2, "Titre trop court").max(160),
  description: optionalText(1000),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null),
});

export const calendarSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  starts_at: z.string().min(10),
  location: optionalText(200),
});

export const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().max(4000).default(""),
});

export const reportSchema = z.object({
  target_type: z.enum(["project", "comment", "message", "profile", "opportunity"]),
  target_id: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "inappropriate", "scam", "impersonation", "other"]),
  details: optionalText(1000),
});

export const opportunitySchema = z.object({
  kind: z.enum(["mission", "collaboration", "call", "partnership", "service"]),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(20, "Description trop courte (20 caractères min.)").max(4000),
  skills: tags(15),
  city: optionalText(80),
  is_remote: z.boolean().default(false),
  compensation: optionalText(120),
});

export const proposalSchema = z.object({
  project_id: z.string().uuid(),
  message: z.string().trim().min(10).max(2000),
  proposed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null),
  proposed_venue: optionalText(200),
  proposed_price_eur: optionalNumber(z.number().min(0).max(100_000)),
});

/** Flattens Zod issues into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

export function eurosToCents(v: number | null | undefined): number | null {
  return v == null ? null : Math.round(v * 100);
}
