import type { BusinessProfile } from "@/lib/types";

/**
 * The single non-negotiable rule injected into every prompt that touches
 * business-facing content: never fabricate facts about the business. This
 * mirrors the product requirement that Seedflow must never invent prices,
 * hours, certifications, reviews, results, guarantees, client logos or
 * awards. When information is missing, the model must use a clearly marked
 * placeholder or omit the claim entirely — never assert it as fact.
 */
export const GROUNDING_RULES = `Règles impératives, sans exception :
- N'invente JAMAIS d'information commerciale réelle : prix, horaires, certifications, avis clients, résultats chiffrés, garanties, partenaires, récompenses, logos clients.
- Si une information n'est pas fournie dans le profil business ci-dessous, utilise un texte de type placeholder explicite (ex. "[À compléter : tarif]") ou omets simplement l'élément — ne le présente jamais comme un fait.
- N'écris pas de témoignages clients fictifs.
- Le contenu doit rester fidèle au secteur, au ton et au positionnement fournis.
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans balises markdown.`;

export function buildBusinessContext(profile: BusinessProfile): string {
  const lines = [
    `Entreprise : ${profile.company || "(non renseigné)"}`,
    `Secteur : ${profile.industry || "(non renseigné)"}`,
    `Activité : ${profile.activity || "(non renseigné)"}`,
    `Localisation : ${profile.location || "(non renseigné)"}`,
    `Services : ${(profile.services ?? []).join(", ") || "(non renseigné)"}`,
    `Clientèle cible : ${profile.target_audience || "(non renseigné)"}`,
    `Positionnement : ${profile.positioning || "(non renseigné)"}`,
    `Niveau de gamme : ${profile.price_tier || "(non renseigné)"}`,
    `Ton souhaité : ${profile.tone || "(non renseigné)"}`,
    `Style visuel souhaité : ${profile.visual_style || "(non renseigné)"}`,
    `Objectifs : ${(profile.goals ?? []).join(", ") || "(non renseigné)"}`,
    `Email de contact : ${profile.contact?.email || "(non renseigné)"}`,
    `Téléphone de contact : ${profile.contact?.phone || "(non renseigné)"}`,
    `Adresse : ${profile.contact?.address || "(non renseigné)"}`,
    `Couleurs de marque : ${(profile.brand_colors ?? []).join(", ") || "(aucune, à ta discrétion selon le style)"}`,
  ];
  return lines.join("\n");
}
