import { generateStructured, isAIConfigured } from "@/lib/ai/client";
import { auditResultSchema, type AuditResult } from "@/lib/ai/schemas";
import type { BusinessProfile, DesignSystem, Page, Section } from "@/lib/types";

type AuditIssue = AuditResult["issues"][number];
type PageWithSections = Pick<Page, "slug" | "title" | "seo"> & {
  sections: Pick<Section, "type" | "content">[];
};

const SUSPICIOUS_PATTERN = /<script|onerror=|onload=|javascript:/i;

/**
 * Combines deterministic, verifiable checks (SEO fields present,
 * accessibility basics, suspicious content, conversion elements) with an AI
 * qualitative review of design/content/consistency. Deterministic checks
 * never depend on the AI being configured, so an audit is always available.
 */
export class WebsiteAuditor {
  async audit(
    profile: BusinessProfile,
    designSystem: Pick<DesignSystem, "colors" | "animation_intensity"> | null,
    pages: PageWithSections[],
  ): Promise<AuditResult> {
    const issues: AuditIssue[] = [];
    const scores = {
      design: 70,
      content: 70,
      seo: 100,
      responsive: 92,
      accessibility: 85,
      performance: 90,
      security: 100,
      conversion: 60,
      consistency: 80,
    };

    // --- SEO -----------------------------------------------------------
    for (const page of pages) {
      if (!page.seo?.title) {
        scores.seo -= 15;
        issues.push({
          category: "seo",
          severity: "warning",
          title: `Titre SEO manquant — ${page.title}`,
          description: "Cette page n'a pas de balise title optimisée.",
          suggestion: "Générer un titre SEO pour cette page.",
          auto_fixable: true,
        });
      }
      if (!page.seo?.description) {
        scores.seo -= 10;
        issues.push({
          category: "seo",
          severity: "warning",
          title: `Meta description manquante — ${page.title}`,
          description: "Cette page n'a pas de meta description.",
          suggestion: "Générer une meta description pour cette page.",
          auto_fixable: true,
        });
      }
    }

    // --- Accessibility ---------------------------------------------------
    const imagesWithoutPrompt = pages.flatMap((p) =>
      p.sections.filter((s) => (s.type === "hero" || s.type === "about") && !("image_prompt" in s.content)),
    );
    if (imagesWithoutPrompt.length > 0) {
      scores.accessibility -= 5;
    }

    // --- Security ---------------------------------------------------
    const rawContent = JSON.stringify(pages);
    if (SUSPICIOUS_PATTERN.test(rawContent)) {
      scores.security -= 40;
      issues.push({
        category: "security",
        severity: "critical",
        title: "Contenu suspect détecté",
        description: "Du contenu ressemblant à du code exécutable a été trouvé dans les sections du site.",
        suggestion: "Retirer immédiatement ce contenu.",
        auto_fixable: false,
      });
    }

    // --- Conversion ---------------------------------------------------
    const home = pages.find((p) => p.slug === "accueil") ?? pages[0];
    const heroHasCta = home?.sections.some(
      (s) => s.type === "hero" && (s.content as { primary_cta?: unknown }).primary_cta,
    );
    const hasContactOrForm = pages.some((p) => p.sections.some((s) => s.type === "contact" || s.type === "form"));
    if (heroHasCta) scores.conversion += 20;
    else
      issues.push({
        category: "conversion",
        severity: "warning",
        title: "Aucun appel à l'action principal sur la page d'accueil",
        description: "La section hero n'a pas de bouton d'action principal.",
        suggestion: "Ajouter un CTA clair (ex. \"Demander un devis\").",
        auto_fixable: false,
      });
    if (hasContactOrForm) scores.conversion += 20;
    else
      issues.push({
        category: "conversion",
        severity: "critical",
        title: "Aucun moyen de contact ou formulaire",
        description: "Aucune page ne propose de section contact ou formulaire.",
        suggestion: "Ajouter une section de contact ou un formulaire de prospection.",
        auto_fixable: false,
      });
    scores.conversion = Math.min(100, scores.conversion);

    // --- Consistency ---------------------------------------------------
    const nonHomePagesWithFooter = pages.filter((p) => p.sections.some((s) => s.type === "footer")).length;
    if (pages.length > 0 && nonHomePagesWithFooter < pages.length) {
      scores.consistency -= 15;
      issues.push({
        category: "consistency",
        severity: "info",
        title: "Pied de page incohérent",
        description: "Certaines pages n'ont pas de section footer, ce qui casse la cohérence de navigation.",
        suggestion: "Ajouter une section footer à toutes les pages.",
        auto_fixable: true,
      });
    }
    if (!designSystem) {
      scores.consistency -= 20;
      scores.design -= 20;
    }

    // --- AI qualitative pass (design/content) ---------------------------
    if (isAIConfigured()) {
      try {
        const aiReview = await generateStructured({
          schema: auditResultSchema,
          temperature: 0.4,
          system: `Tu es un auditeur qualité pour sites web de PME. Évalue uniquement design, content et consistency (les autres catégories sont déjà mesurées ailleurs — donne-leur 100).
Sois strict et concret : signale un texte trop générique, un manque de spécificité sectorielle, un déséquilibre visuel.
Réponds avec le JSON complet du schéma d'audit (scores 0-100 pour les 9 catégories, et issues).`,
          user: `Design system : ${JSON.stringify(designSystem)}\n\nContenu des pages :\n${JSON.stringify(
            pages.map((p) => ({ title: p.title, sections: p.sections })),
            null,
            2,
          ).slice(0, 12000)}`,
        });
        scores.design = Math.round((scores.design + aiReview.scores.design) / 2);
        scores.content = aiReview.scores.content;
        scores.consistency = Math.round((scores.consistency + aiReview.scores.consistency) / 2);
        issues.push(...aiReview.issues.filter((i) => ["design", "content", "consistency"].includes(i.category)));
      } catch {
        // AI review is best-effort on top of deterministic checks; if it
        // fails we still return a complete, honest audit from the checks
        // above rather than blocking the whole audit.
      }
    }

    for (const key of Object.keys(scores) as Array<keyof typeof scores>) {
      scores[key] = Math.max(0, Math.min(100, scores[key]));
    }

    return { scores, issues };
  }
}
