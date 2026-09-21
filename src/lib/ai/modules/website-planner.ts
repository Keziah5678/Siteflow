import { generateStructured } from "@/lib/ai/client";
import { buildBusinessContext } from "@/lib/ai/prompts";
import { websiteStructureSchema, type WebsiteStructure } from "@/lib/ai/schemas";
import type { BusinessProfile, DesignSystem } from "@/lib/types";

const AVAILABLE_PAGES = [
  "Accueil",
  "Services",
  "Service individuel (une page par service clé si pertinent)",
  "À propos",
  "Réalisations",
  "Galerie",
  "FAQ",
  "Contact",
  "Prise de rendez-vous",
  "Mentions légales",
  "Politique de confidentialité",
];

/**
 * Decides the site's structure: which pages are actually relevant for this
 * business (never all of them by default), their navigation, and which
 * section types compose each page. Content itself is filled in afterwards
 * by ContentGenerator — this module only plans the skeleton.
 */
export class WebsitePlanner {
  async plan(profile: BusinessProfile, designSystem: Pick<DesignSystem, "animation_intensity">): Promise<WebsiteStructure> {
    return generateStructured({
      schema: websiteStructureSchema,
      temperature: 0.5,
      system: `Tu es un architecte de sites web pour petites et moyennes entreprises.
À partir d'un profil business, tu décides QUELLES pages sont pertinentes (jamais systématiquement toutes) parmi : ${AVAILABLE_PAGES.join(", ")}.
Une seule page doit avoir is_home = true, avec le slug "accueil".
Pour chaque page, choisis les types de sections pertinents parmi : hero, services, about, gallery, faq, contact, cta, features, process, pricing, form, text, footer, nav.
La page d'accueil doit inclure au minimum : hero, puis 2 à 5 sections pertinentes, et se termine par footer.
N'inclus "pricing" que si le profil justifie d'afficher des tarifs publics (jamais de prix inventés — le contenu réel sera géré séparément).
Limite le nombre total de pages à ce qui est réellement utile (généralement 3 à 7 pages pour une PME).
Réponds uniquement avec un JSON : {"pages": [{"slug": "...", "title": "...", "is_home": bool, "section_types": ["hero", ...]}]}`,
      user: `Profil business :\n${buildBusinessContext(profile)}\n\nIntensité d'animation cible : ${designSystem.animation_intensity}.\n\nPlanifie la structure du site.`,
    });
  }
}
