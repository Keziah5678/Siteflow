import { DesignGenerator } from "@/lib/ai/modules/design-generator";
import { WebsitePlanner } from "@/lib/ai/modules/website-planner";
import { ContentGenerator } from "@/lib/ai/modules/content-generator";
import { SEOGenerator } from "@/lib/ai/modules/seo-generator";
import { FormGenerator } from "@/lib/ai/modules/form-generator";
import { ImageGenerationService } from "@/lib/ai/modules/image-generation-service";
import { LeadQualifier } from "@/lib/ai/modules/lead-qualifier";
import { WebsiteAssistant } from "@/lib/ai/modules/website-assistant";
import { WebsiteAuditor } from "@/lib/ai/modules/website-auditor";
import { ModificationAgent } from "@/lib/ai/modules/modification-agent";
import type { BusinessProfile, DesignSystem } from "@/lib/types";
import type { WebsitePlan } from "@/lib/ai/schemas";

/**
 * Central coordinator for Seedflow's AI system. It never contains business
 * logic itself — it sequences the specialized modules and assembles their
 * outputs into a single, validated WebsitePlan. Each module owns one
 * responsibility (design, structure, copy, SEO, forms) so prompts stay
 * focused and outputs stay independently testable.
 */
export class Orchestrator {
  readonly design = new DesignGenerator();
  readonly planner = new WebsitePlanner();
  readonly content = new ContentGenerator();
  readonly seo = new SEOGenerator();
  readonly forms = new FormGenerator();
  readonly images = new ImageGenerationService();
  readonly leadQualifier = new LeadQualifier();
  readonly assistant = new WebsiteAssistant();
  readonly auditor = new WebsiteAuditor();
  readonly modification = new ModificationAgent();

  /** Full website generation pipeline: design -> structure -> content -> SEO. */
  async generateWebsite(
    profile: BusinessProfile,
  ): Promise<{ plan: WebsitePlan; designSystem: Omit<DesignSystem, "id" | "project_id" | "created_at" | "updated_at"> }> {
    const designSystem = await this.design.generate(profile);
    const structure = await this.planner.plan(profile, designSystem);
    const filled = await this.content.generate(profile, structure);
    const seoPlan = await this.seo.generate(profile, filled.pages);

    const seoBySlug = new Map(seoPlan.pages.map((p) => [p.slug, p.seo]));
    const pages = filled.pages.map((page) => ({
      ...page,
      seo: seoBySlug.get(page.slug) ?? page.seo ?? {},
    }));

    const plan: WebsitePlan = {
      design_system: designSystem,
      pages,
      global_seo: seoPlan.global_seo,
    };

    return { plan, designSystem };
  }
}

export const orchestrator = new Orchestrator();
