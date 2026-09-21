"use client";

import { PagePreview } from "@/components/site-renderer/page-preview";
import { AssistantWidget } from "@/components/site-renderer/assistant-widget";
import type { BusinessProfile, DesignSystem, Page, ProjectForm, Section } from "@/lib/types";

export function PublicSiteView({
  projectId,
  page,
  navLinks,
  businessProfile,
  designSystem,
  forms,
  basePath,
}: {
  projectId: string;
  page: Page & { sections: Section[] };
  navLinks: { label: string; href: string }[];
  businessProfile: BusinessProfile;
  designSystem: DesignSystem;
  forms: ProjectForm[];
  basePath: string;
}) {
  async function handleSubmitLead(formId: string, values: Record<string, string>) {
    const res = await fetch(`/api/public/forms/${formId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Échec de l'envoi du formulaire.");
    }
  }

  return (
    <>
      <PagePreview
        page={page}
        navLinks={navLinks}
        businessProfile={businessProfile}
        designSystem={designSystem}
        forms={forms}
        basePath={basePath}
        onSubmitLead={handleSubmitLead}
      />
      <AssistantWidget projectId={projectId} designSystem={designSystem} companyName={businessProfile.company} />
    </>
  );
}
