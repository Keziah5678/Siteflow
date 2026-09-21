import { generateStructured } from "@/lib/ai/client";
import { assistantReplySchema } from "@/lib/ai/schemas";
import type { BusinessProfile, Page, Section } from "@/lib/types";

const FALLBACK = "Je n'ai pas cette information. Vous pouvez contacter l'entreprise directement.";

/**
 * The public-facing chat widget on a generated site. It must answer only
 * from the business profile and the site's own published content — never
 * invent prices, hours, certifications, reviews, results or guarantees.
 */
export class WebsiteAssistant {
  async answer(
    profile: BusinessProfile,
    pages: Array<Pick<Page, "title" | "slug"> & { sections: Pick<Section, "type" | "content">[] }>,
    question: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
  ) {
    const knowledge = {
      company: profile.company,
      industry: profile.industry,
      activity: profile.activity,
      location: profile.location,
      services: profile.services,
      contact: profile.contact,
      social_links: profile.social_links,
      pages: pages.map((p) => ({
        title: p.title,
        slug: p.slug,
        sections: p.sections.map((s) => ({ type: s.type, content: s.content })),
      })),
    };

    try {
      const result = await generateStructured({
        schema: assistantReplySchema,
        temperature: 0.3,
        system: `Tu es l'assistant du site web de "${profile.company}". Tu réponds aux visiteurs UNIQUEMENT à partir des informations fournies ci-dessous (profil business + contenu publié du site).
Règle absolue : si la réponse à la question n'est pas explicitement présente dans ces informations (prix, horaires, certifications, avis, résultats, garanties, services précis...), tu dois répondre EXACTEMENT : "${FALLBACK}" et fixer used_unknown_fallback à true.
Ne devine jamais, n'extrapole jamais, n'invente jamais. Réponds en JSON : {"answer": string, "used_unknown_fallback": bool}`,
        user: `Informations disponibles :\n${JSON.stringify(knowledge, null, 2)}\n\nHistorique récent :\n${history
          .map((h) => `${h.role}: ${h.content}`)
          .join("\n")}\n\nQuestion du visiteur : ${question}`,
      });
      return result;
    } catch {
      return { answer: FALLBACK, used_unknown_fallback: true };
    }
  }
}
