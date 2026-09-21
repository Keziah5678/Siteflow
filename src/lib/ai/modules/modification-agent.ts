import { generateStructured } from "@/lib/ai/client";
import { GROUNDING_RULES } from "@/lib/ai/prompts";
import { modificationDiffSchema, type ModificationDiff } from "@/lib/ai/schemas";
import type { WebsiteSnapshot } from "@/lib/types";

/**
 * Turns a natural-language instruction ("Rends le site plus premium",
 * "Ajoute une page pour le dépannage", "Change le bleu en noir") into a
 * structured diff of concrete operations against the current site
 * snapshot. The API route applies the diff to the database — the model
 * never edits the site directly, it only proposes structured operations
 * validated against modificationDiffSchema.
 */
export class ModificationAgent {
  async interpret(instruction: string, snapshot: WebsiteSnapshot): Promise<ModificationDiff> {
    const compactSnapshot = {
      design_system: snapshot.design_system,
      pages: snapshot.pages.map((p) => ({
        slug: p.slug,
        title: p.title,
        sections: p.sections.map((s, i) => ({ index: i, type: s.type, content: s.content })),
      })),
    };

    return generateStructured({
      schema: modificationDiffSchema,
      temperature: 0.4,
      system: `Tu es l'agent de modification de Seedflow. Tu reçois une demande en langage naturel et l'état actuel du site, et tu dois produire une liste d'opérations structurées à appliquer — jamais de texte libre non structuré.
${GROUNDING_RULES}
Opérations disponibles :
- update_design_system: {"op": "update_design_system", "patch": {...champs du design system à changer}}
- update_section: {"op": "update_section", "page_slug": string, "section_index": number, "patch": {...champs de content à fusionner}}
- add_section: {"op": "add_section", "page_slug": string, "position": number, "section": {"type": "...", "content": {...}}}
- remove_section: {"op": "remove_section", "page_slug": string, "section_index": number}
- add_page: {"op": "add_page", "page": {"slug": string, "title": string, "is_home": false, "sections": [...]}}
- remove_page: {"op": "remove_page", "page_slug": string}

Règles :
- Utilise section_index / page_slug EXACTS de l'état actuel fourni.
- "Rends le site plus premium/moderne" → ajuste le design system (radii, shadows, typography, spacing_scale, animation_intensity) via update_design_system, pas juste le texte.
- "Change le bleu en noir" → update_design_system avec les couleurs concernées.
- "Ajoute plus d'espace" → spacing_scale: "airy" (et/ou scale de typography).
- "Ajoute une page pour X" → add_page avec des sections cohérentes (hero + contenu + footer).
- Si la demande est ambiguë ou impossible à traduire en opérations sûres, laisse "operations" vide et remplis "clarification_needed" avec une question précise à poser à l'utilisateur.
Réponds uniquement avec le JSON du schéma : {"summary": string, "operations": [...], "clarification_needed": string|null}`,
      user: `État actuel du site :\n${JSON.stringify(compactSnapshot).slice(0, 14000)}\n\nDemande de l'utilisateur : "${instruction}"`,
    });
  }
}
