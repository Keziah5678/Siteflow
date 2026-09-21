import { z } from "zod";

// ----------------------------------------------------------------------------
// Business profile — what the intelligent questionnaire collects. Every
// field is optional at the schema level because the wizard saves
// progressively (autosave per step); `completeness` tracks how much of the
// profile is actually filled in.
// ----------------------------------------------------------------------------
export const businessProfileInputSchema = z.object({
  company: z.string().trim().min(1).max(120).optional(),
  industry: z.string().trim().max(60).optional(),
  activity: z.string().trim().max(500).optional(),
  location: z.string().trim().max(160).optional(),
  services: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  target_audience: z.string().trim().max(300).optional(),
  goals: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  positioning: z.string().trim().max(300).optional(),
  tone: z.string().trim().max(60).optional(),
  visual_style: z.string().trim().max(60).optional(),
  price_tier: z.enum(["economique", "milieu-de-gamme", "premium", "luxe"]).optional(),
  contact: z
    .object({
      email: z.string().trim().email().or(z.literal("")).optional(),
      phone: z.string().trim().max(40).optional(),
      address: z.string().trim().max(200).optional(),
    })
    .optional(),
  social_links: z.record(z.string(), z.string().trim().max(300)).optional(),
  brand_colors: z.array(z.string().trim().max(20)).max(6).optional(),
  has_logo: z.boolean().optional(),
  logo_url: z.string().trim().url().or(z.literal("")).nullable().optional(),
  photos: z.array(z.string().trim().url()).max(20).optional(),
  raw_answers: z.record(z.string(), z.unknown()).optional(),
});

export type BusinessProfileInput = z.infer<typeof businessProfileInputSchema>;

const REQUIRED_FIELDS: Array<keyof BusinessProfileInput> = [
  "company",
  "industry",
  "activity",
  "location",
  "target_audience",
  "positioning",
  "tone",
  "visual_style",
];

/** Simple, transparent completeness heuristic — no AI guesswork. */
export function computeCompleteness(profile: Record<string, unknown>): number {
  let filled = 0;
  for (const field of REQUIRED_FIELDS) {
    const value = profile[field];
    if (typeof value === "string" && value.trim().length > 0) filled += 1;
  }
  const services = profile.services;
  const goals = profile.goals;
  const contact = profile.contact as { email?: string; phone?: string } | undefined;

  let bonus = 0;
  if (Array.isArray(services) && services.length > 0) bonus += 1;
  if (Array.isArray(goals) && goals.length > 0) bonus += 1;
  if (contact?.email || contact?.phone) bonus += 1;

  const total = REQUIRED_FIELDS.length + 3;
  return Math.round(((filled + bonus) / total) * 100);
}

// ----------------------------------------------------------------------------
// Structured AI outputs — the orchestrator modules must return exactly these
// shapes so results can be persisted deterministically. Keeping the schemas
// here means every module and every API route validates against the same
// contract instead of trusting free-form model output.
// ----------------------------------------------------------------------------

export const sectionTypeSchema = z.enum([
  "hero",
  "services",
  "about",
  "gallery",
  "faq",
  "contact",
  "cta",
  "features",
  "process",
  "pricing",
  "form",
  "text",
  "footer",
  "nav",
]);

export const sectionPlanSchema = z.object({
  type: sectionTypeSchema,
  content: z.record(z.string(), z.unknown()),
});

export const pagePlanSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(80),
  is_home: z.boolean().default(false),
  seo: z
    .object({
      title: z.string().trim().max(70).optional(),
      description: z.string().trim().max(180).optional(),
    })
    .optional(),
  sections: z.array(sectionPlanSchema).min(1).max(14),
});

export const designSystemPlanSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    foreground: z.string(),
    muted: z.string(),
    border: z.string(),
  }),
  typography: z.object({
    heading_font: z.string(),
    body_font: z.string(),
    scale: z.enum(["compact", "comfortable", "spacious"]),
  }),
  spacing_scale: z.enum(["tight", "regular", "airy"]),
  radii: z.enum(["sharp", "soft", "round"]),
  shadows: z.enum(["none", "subtle", "elevated"]),
  button_style: z.enum(["solid", "outline", "soft", "minimal"]),
  animation_intensity: z.enum(["minimal", "subtle", "balanced", "dynamic", "immersive"]),
});

export const pageStructureSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(80),
  is_home: z.boolean().default(false),
  section_types: z.array(sectionTypeSchema).min(1).max(10),
});

export const websiteStructureSchema = z.object({
  pages: z.array(pageStructureSchema).min(1).max(11),
});

export type WebsiteStructure = z.infer<typeof websiteStructureSchema>;

export const contentFilledPagesSchema = z.object({
  pages: z.array(pagePlanSchema).min(1).max(11),
});

export const seoPlanSchema = z.object({
  global_seo: z.object({
    site_title: z.string().max(70),
    site_description: z.string().max(180),
  }),
  pages: z.array(
    z.object({
      slug: z.string(),
      seo: z.object({
        title: z.string().max(70),
        description: z.string().max(180),
      }),
    }),
  ),
});

export const websitePlanSchema = z.object({
  design_system: designSystemPlanSchema,
  pages: z.array(pagePlanSchema).min(1).max(11),
  global_seo: z.object({
    site_title: z.string().max(70),
    site_description: z.string().max(180),
  }),
});

export type WebsitePlan = z.infer<typeof websitePlanSchema>;

export const modificationDiffSchema = z.object({
  summary: z.string().max(240),
  operations: z
    .array(
      z.union([
        z.object({
          op: z.literal("update_design_system"),
          patch: z.record(z.string(), z.unknown()),
        }),
        z.object({
          op: z.literal("update_section"),
          page_slug: z.string(),
          section_index: z.number().int().nonnegative(),
          patch: z.record(z.string(), z.unknown()),
        }),
        z.object({
          op: z.literal("add_section"),
          page_slug: z.string(),
          position: z.number().int().nonnegative(),
          section: sectionPlanSchema,
        }),
        z.object({
          op: z.literal("remove_section"),
          page_slug: z.string(),
          section_index: z.number().int().nonnegative(),
        }),
        z.object({
          op: z.literal("add_page"),
          page: pagePlanSchema,
        }),
        z.object({
          op: z.literal("remove_page"),
          page_slug: z.string(),
        }),
      ]),
    )
    .max(30),
  clarification_needed: z.string().nullable().optional(),
});

export type ModificationDiff = z.infer<typeof modificationDiffSchema>;

export const auditResultSchema = z.object({
  scores: z.object({
    design: z.number().min(0).max(100),
    content: z.number().min(0).max(100),
    seo: z.number().min(0).max(100),
    responsive: z.number().min(0).max(100),
    accessibility: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
    security: z.number().min(0).max(100),
    conversion: z.number().min(0).max(100),
    consistency: z.number().min(0).max(100),
  }),
  issues: z.array(
    z.object({
      category: z.enum([
        "design",
        "content",
        "seo",
        "responsive",
        "accessibility",
        "performance",
        "security",
        "conversion",
        "consistency",
      ]),
      severity: z.enum(["info", "warning", "critical"]),
      title: z.string().max(120),
      description: z.string().max(400),
      suggestion: z.string().max(400).nullable(),
      auto_fixable: z.boolean(),
    }),
  ),
});

export type AuditResult = z.infer<typeof auditResultSchema>;

export const formPlanSchema = z.object({
  name: z.string().max(80),
  type: z.enum(["devis", "rendez-vous", "contact", "intervention", "information"]),
  fields: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().max(80),
        type: z.enum(["text", "email", "tel", "textarea", "select", "date", "checkbox"]),
        required: z.boolean(),
        options: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(12),
});

export type FormPlan = z.infer<typeof formPlanSchema>;

export const formsPlanSchema = z.object({
  forms: z.array(formPlanSchema).min(1).max(4),
});

export const leadQualificationSchema = z.object({
  status: z.enum(["nouveau", "contacte", "qualifie", "rendez-vous", "proposition", "gagne", "perdu"]),
  score: z.number().min(0).max(100),
  reasoning: z.string().max(300),
});

export const assistantReplySchema = z.object({
  answer: z.string().max(800),
  used_unknown_fallback: z.boolean(),
});
