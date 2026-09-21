"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PagePreview } from "@/components/site-renderer/page-preview";
import { ViewportFrame, ViewportSwitcher, type Viewport } from "@/components/site-renderer/viewport-frame";
import { ModificationChat } from "@/components/chat/modification-chat";
import { cn } from "@/lib/utils";
import type { BusinessProfile, DesignSystem, Message, Page, ProjectForm, Section } from "@/lib/types";

type PageWithSections = Page & { sections: Section[] };

export function SiteEditor({
  projectId,
  pages,
  designSystem,
  businessProfile,
  forms,
  initialMessages,
}: {
  projectId: string;
  pages: PageWithSections[];
  designSystem: DesignSystem;
  businessProfile: BusinessProfile;
  forms: ProjectForm[];
  initialMessages: Message[];
}) {
  const [activeSlug, setActiveSlug] = useState(pages.find((p) => p.is_home)?.slug ?? pages[0]?.slug);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const activePage = pages.find((p) => p.slug === activeSlug) ?? pages[0];
  const navLinks = pages
    .filter((p) => p.status === "published")
    .sort((a, b) => a.nav_order - b.nav_order)
    .map((p) => ({ label: p.title, href: p.is_home ? "/" : `/${p.slug}` }));

  if (!activePage) return null;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveSlug(p.slug)}
              className={cn(
                "focus-ring shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors",
                p.slug === activeSlug
                  ? "bg-surface-raised font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.title}
            </button>
          ))}
          <button
            className="focus-ring flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            title="Demandez à l'IA d'ajouter une page via le chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <ViewportSwitcher value={viewport} onChange={setViewport} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
        <ViewportFrame viewport={viewport}>
          <PagePreview
            page={activePage}
            navLinks={navLinks}
            businessProfile={businessProfile}
            designSystem={designSystem}
            forms={forms}
          />
        </ViewportFrame>
        <div className="hidden min-h-0 border-l border-border lg:block">
          <ModificationChat projectId={projectId} initialMessages={initialMessages} />
        </div>
      </div>
    </div>
  );
}
