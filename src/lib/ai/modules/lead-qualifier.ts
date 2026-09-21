import { generateStructured } from "@/lib/ai/client";
import { buildBusinessContext } from "@/lib/ai/prompts";
import { leadQualificationSchema } from "@/lib/ai/schemas";
import type { BusinessProfile, Lead } from "@/lib/types";

/** Suggests a pipeline status and priority score for a newly captured lead. */
export class LeadQualifier {
  async qualify(profile: BusinessProfile, lead: Pick<Lead, "message" | "form_data" | "source">) {
    return generateStructured({
      schema: leadQualificationSchema,
      temperature: 0.3,
      system: `Tu qualifies des prospects entrants pour une PME.
Analyse le message et les données du formulaire pour estimer :
- un statut de départ dans le pipeline (généralement "nouveau", ou "qualifie" si la demande est très précise et actionnable)
- un score de priorité de 0 à 100 (urgence, clarté du besoin, adéquation avec l'activité)
- une justification courte
Ne déduis jamais d'informations qui ne sont pas dans le message. Réponds en JSON : {"status": "...", "score": number, "reasoning": string}`,
      user: `Profil business :\n${buildBusinessContext(profile)}\n\nProspect :\nSource : ${lead.source}\nMessage : ${
        lead.message || "(aucun)"
      }\nDonnées du formulaire : ${JSON.stringify(lead.form_data)}`,
    });
  }
}
