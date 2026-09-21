import { generateStructured } from "@/lib/ai/client";
import { buildBusinessContext } from "@/lib/ai/prompts";
import { designSystemPlanSchema } from "@/lib/ai/schemas";
import type { BusinessProfile, DesignSystem } from "@/lib/types";

/**
 * Produces a coherent, project-specific design system (colors, typography,
 * spacing, radii, shadows, button style, animation intensity) from the
 * business profile. Every other generated surface reads this instead of
 * hardcoding style choices, so a single edit here propagates everywhere.
 */
export class DesignGenerator {
  async generate(profile: BusinessProfile): Promise<Omit<DesignSystem, "id" | "project_id" | "created_at" | "updated_at">> {
    const result = await generateStructured({
      schema: designSystemPlanSchema,
      temperature: 0.7,
      system: `Tu es un directeur artistique spécialisé en design system pour sites web professionnels.
Tu produis des systèmes de design sobres, cohérents et différenciés — jamais de gradients par défaut, jamais de violet générique de template IA.
Choisis des couleurs (codes hexadécimaux) cohérentes avec le secteur, le ton et le niveau de gamme fournis. "background" et "surface" doivent rester proches (thème clair professionnel par défaut) avec un excellent contraste texte/fond.
Réponds uniquement avec un JSON respectant ce schéma :
{
  "colors": {"primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "surface": "#hex", "foreground": "#hex", "muted": "#hex", "border": "#hex"},
  "typography": {"heading_font": "nom de police Google Fonts", "body_font": "nom de police Google Fonts", "scale": "compact|comfortable|spacious"},
  "spacing_scale": "tight|regular|airy",
  "radii": "sharp|soft|round",
  "shadows": "none|subtle|elevated",
  "button_style": "solid|outline|soft|minimal",
  "animation_intensity": "minimal|subtle|balanced|dynamic|immersive"
}`,
      user: `Profil business :\n${buildBusinessContext(profile)}\n\nGénère le design system le plus adapté à ce positionnement.`,
    });

    return result;
  }
}
