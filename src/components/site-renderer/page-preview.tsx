"use client";

import { DesignSystemProvider } from "@/components/site-renderer/design-system-provider";
import { SectionRenderer } from "@/components/site-renderer/section-renderer";
import type { BusinessProfile, DesignSystem, Page, ProjectForm, Section } from "@/lib/types";

export function PagePreview({
  page,
  navLinks,
  businessProfile,
  designSystem,
  forms,
  basePath = "",
  onSubmitLead,
}: {
  page: Page & { sections: Section[] };
  navLinks: { label: string; href: string }[];
  businessProfile: BusinessProfile;
  designSystem: DesignSystem;
  forms: ProjectForm[];
  basePath?: string;
  onSubmitLead?: (formId: string, values: Record<string, string>) => Promise<void>;
}) {
  const sections = [...page.sections].sort((a, b) => a.position - b.position);
  const hasNav = sections.some((s) => s.type === "nav");
  const ctx = { businessProfile, forms, navLinks, basePath, onSubmitLead };

  return (
    <DesignSystemProvider designSystem={designSystem} className="min-h-full">
      {!hasNav ? (
        <SectionRenderer
          section={{ id: "synthetic-nav", page_id: page.id, type: "nav", position: -1, content: {}, created_at: "", updated_at: "" }}
          ctx={ctx}
        />
      ) : null}
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} ctx={ctx} />
      ))}
    </DesignSystemProvider>
  );
}
