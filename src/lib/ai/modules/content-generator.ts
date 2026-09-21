import { generateStructured } from "@/lib/ai/client";
import { buildBusinessContext, GROUNDING_RULES } from "@/lib/ai/prompts";
import { contentFilledPagesSchema } from "@/lib/ai/schemas";
import type { BusinessProfile } from "@/lib/types";
import type { WebsiteStructure } from "@/lib/ai/schemas";

const CONTENT_CONVENTIONS = `Pour chaque type de section, respecte cette structure de "content" :
- hero: {"eyebrow"?: string, "title": string, "subtitle": string, "primary_cta"?: {"label": string, "href": string}, "secondary_cta"?: {"label": string, "href": string}, "image_prompt"?: string}
- services: {"title": string, "description"?: string, "items": [{"title": string, "description": string}]}
- about: {"title": string, "body": string, "image_prompt"?: string}
- gallery: {"title": string, "image_prompts": string[]}
- faq: {"title": string, "items": [{"question": string, "answer": string}]}
- contact: {"title": string, "description"?: string}
- cta: {"title": string, "description"?: string, "cta": {"label": string, "href": string}}
- features: {"title": string, "items": [{"title": string, "description": string}]}
- process: {"title": string, "steps": [{"title": string, "description": string}]}
- pricing: {"title": string, "note": string} — "note" doit rester générique du type "Contactez-nous pour un devis personnalisé", JAMAIS de montants inventés
- form: {"title": string, "description"?: string, "form_type": "devis"|"rendez-vous"|"contact"|"intervention"|"information"}
- text: {"title": string, "body": string}
- footer: {"tagline"?: string, "legal_links": [{"label": string, "href": string}]}
- nav: {"links": [{"label": string, "href": string}]}
image_prompt doit décrire une image cohérente avec le secteur/l'ambiance/les couleurs (sera utilisée par un service de génération d'images séparé), jamais une description de photo de stock générique.`;

/**
 * Fills every planned section with real, grounded copy for the given
 * business. Receives the page/section skeleton from WebsitePlanner and
 * returns the same structure enriched with `content`.
 */
export class ContentGenerator {
  async generate(profile: BusinessProfile, structure: WebsiteStructure) {
    return generateStructured({
      schema: contentFilledPagesSchema,
      temperature: 0.75,
      system: `Tu es un rédacteur web professionnel spécialisé dans les sites de PME.
Tu écris un contenu concret, spécifique à l'activité décrite — jamais de texte générique interchangeable.
${GROUNDING_RULES}
${CONTENT_CONVENTIONS}
Réponds avec un JSON : {"pages": [{"slug": "...", "title": "...", "is_home": bool, "sections": [{"type": "...", "content": {...}}]}]}. Conserve exactement les pages, slugs et types de sections fournis, dans le même ordre.`,
      user: `Profil business :\n${buildBusinessContext(profile)}\n\nStructure du site à remplir :\n${JSON.stringify(structure.pages, null, 2)}`,
    });
  }
}
