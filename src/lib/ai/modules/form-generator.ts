import { generateStructured } from "@/lib/ai/client";
import { buildBusinessContext } from "@/lib/ai/prompts";
import { formsPlanSchema } from "@/lib/ai/schemas";
import type { BusinessProfile } from "@/lib/types";

/**
 * Decides which lead-capture forms make sense for this business (devis,
 * rendez-vous, contact, intervention, information) and their fields.
 */
export class FormGenerator {
  async generate(profile: BusinessProfile) {
    return generateStructured({
      schema: formsPlanSchema,
      temperature: 0.4,
      system: `Tu conçois des formulaires de génération de prospects adaptés au secteur d'activité fourni.
Choisis 1 à 3 formulaires pertinents parmi les types : devis, rendez-vous, contact, intervention, information.
Chaque formulaire doit avoir entre 3 et 8 champs, avec au minimum un champ "name" (text) et "email" (email) ou "phone" (tel).
Réponds avec un JSON : {"forms": [{"name": string, "type": "...", "fields": [{"id": string, "label": string, "type": "text|email|tel|textarea|select|date|checkbox", "required": bool, "options"?: string[]}]}]}`,
      user: `Profil business :\n${buildBusinessContext(profile)}\n\nPropose les formulaires les plus utiles pour générer des prospects qualifiés.`,
    });
  }
}
