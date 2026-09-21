"use client";

import Link from "next/link";
import Image from "next/image";
import { ImageIcon, MapPin, Mail, Phone } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { LeadForm } from "@/components/site-renderer/lead-form";
import type { BusinessProfile, ProjectForm, Section } from "@/lib/types";

interface RenderContext {
  businessProfile: BusinessProfile;
  forms: ProjectForm[];
  navLinks: { label: string; href: string }[];
  /** Prefix under which the site is served ("" in the dashboard editor, "/s/<slug>" publicly). */
  basePath?: string;
  onSubmitLead?: (formId: string, values: Record<string, string>) => Promise<void>;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** AI-generated hrefs are root-relative page slugs (e.g. "/contact") or anchors
 * (e.g. "#contact") — resolve them against the site's actual base path. */
function resolveHref(href: string | undefined, basePath = ""): string {
  if (!href) return `${basePath || "/"}`;
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return href;
  const clean = href.startsWith("/") ? href.slice(1) : href;
  if (!clean) return basePath || "/";
  return `${basePath}/${clean}`;
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--sf-radius-lg)] border border-dashed border-[var(--sf-border)] bg-[var(--sf-muted)]/10 text-[var(--sf-muted)]">
      <div className="flex flex-col items-center gap-2 px-4 text-center text-xs">
        <ImageIcon className="h-5 w-5" />
        {label}
      </div>
    </div>
  );
}

function SectionImage({ prompt, url, className }: { prompt?: string; url?: string; className?: string }) {
  if (url) {
    return (
      <div className={`relative overflow-hidden rounded-[var(--sf-radius-lg)] shadow-[var(--sf-shadow-md)] ${className ?? ""}`}>
        <Image src={url} alt={prompt ?? ""} fill className="object-cover" unoptimized />
      </div>
    );
  }
  return <div className={className}><Placeholder label={prompt ? `Image à générer : ${prompt}` : "Image"} /></div>;
}

export function SectionRenderer({ section, ctx }: { section: Section; ctx: RenderContext }) {
  const c = section.content as Record<string, unknown>;

  switch (section.type) {
    case "nav":
      return (
        <header className="sticky top-0 z-30 border-b border-[var(--sf-border)] bg-[var(--sf-surface)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <span className="text-lg font-semibold [font-family:var(--sf-font-heading)]">
              {ctx.businessProfile.company}
            </span>
            <nav className="hidden gap-6 text-sm sm:flex">
              {ctx.navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="text-[var(--sf-foreground)]/80 hover:text-[var(--sf-accent)]">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      );

    case "hero": {
      const primaryCta = c.primary_cta as { label?: string; href?: string } | undefined;
      const secondaryCta = c.secondary_cta as { label?: string; href?: string } | undefined;
      return (
        <section className="px-6 py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <Reveal>
              {str(c.eyebrow) ? (
                <span className="mb-4 inline-block rounded-full border border-[var(--sf-border)] px-3 py-1 text-xs font-medium text-[var(--sf-accent)]">
                  {str(c.eyebrow)}
                </span>
              ) : null}
              <h1 className="text-4xl font-semibold leading-tight text-balance sm:text-5xl [font-family:var(--sf-font-heading)]">
                {str(c.title, ctx.businessProfile.company)}
              </h1>
              <p className="mt-5 max-w-lg text-lg text-[var(--sf-foreground)]/75 text-balance">{str(c.subtitle)}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {primaryCta?.label ? (
                  <Link
                    href={resolveHref(primaryCta.href || "#contact", ctx.basePath)}
                    className="inline-flex h-12 items-center rounded-[var(--sf-radius-md)] bg-[var(--sf-primary)] px-6 font-medium text-[var(--sf-background)] shadow-[var(--sf-shadow-sm)] transition-opacity hover:opacity-90"
                  >
                    {primaryCta.label}
                  </Link>
                ) : null}
                {secondaryCta?.label ? (
                  <Link
                    href={resolveHref(secondaryCta.href, ctx.basePath)}
                    className="inline-flex h-12 items-center rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] px-6 font-medium hover:bg-[var(--sf-muted)]/10"
                  >
                    {secondaryCta.label}
                  </Link>
                ) : null}
              </div>
            </Reveal>
            <Reveal variant="scale" delay={0.1}>
              <SectionImage prompt={str(c.image_prompt)} url={str(c.image_url) || undefined} className="relative h-72 sm:h-96" />
            </Reveal>
          </div>
        </section>
      );
    }

    case "services": {
      const items = Array.isArray(c.items) ? (c.items as { title?: string; description?: string }[]) : [];
      return (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
              {str(c.description) ? <p className="mt-3 text-[var(--sf-foreground)]/70">{str(c.description)}</p> : null}
            </Reveal>
            <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <StaggerItem key={i}>
                  <div className="h-full rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 shadow-[var(--sf-shadow-sm)]">
                    <h3 className="font-medium [font-family:var(--sf-font-heading)]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[var(--sf-foreground)]/70">{item.description}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
      );
    }

    case "features": {
      const items = Array.isArray(c.items) ? (c.items as { title?: string; description?: string }[]) : [];
      return (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            </Reveal>
            <StaggerGroup className="mt-10 grid gap-6 sm:grid-cols-2">
              {items.map((item, i) => (
                <StaggerItem key={i} className="flex gap-4">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--sf-accent)]" />
                  <div>
                    <h3 className="font-medium [font-family:var(--sf-font-heading)]">{item.title}</h3>
                    <p className="mt-1 text-sm text-[var(--sf-foreground)]/70">{item.description}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
      );
    }

    case "process": {
      const steps = Array.isArray(c.steps) ? (c.steps as { title?: string; description?: string }[]) : [];
      return (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            </Reveal>
            <StaggerGroup className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <StaggerItem key={i}>
                  <span className="text-sm font-medium text-[var(--sf-accent)]">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-medium [font-family:var(--sf-font-heading)]">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--sf-foreground)]/70">{step.description}</p>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
      );
    }

    case "about": {
      return (
        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <SectionImage prompt={str(c.image_prompt)} url={str(c.image_url) || undefined} className="relative h-72 sm:h-96" />
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
              <p className="mt-4 whitespace-pre-line text-[var(--sf-foreground)]/75">{str(c.body)}</p>
            </Reveal>
          </div>
        </section>
      );
    }

    case "text":
      return (
        <section className="px-6 py-20">
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            <p className="mt-4 whitespace-pre-line text-[var(--sf-foreground)]/75">{str(c.body)}</p>
          </Reveal>
        </section>
      );

    case "gallery": {
      const prompts = Array.isArray(c.image_prompts) ? (c.image_prompts as string[]) : [];
      const urls = Array.isArray(c.image_urls) ? (c.image_urls as string[]) : [];
      return (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            </Reveal>
            <StaggerGroup className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {prompts.map((p, i) => (
                <StaggerItem key={i} className="relative aspect-square">
                  <SectionImage prompt={p} url={urls[i]} className="relative h-full w-full" />
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
      );
    }

    case "faq": {
      const items = Array.isArray(c.items) ? (c.items as { question?: string; answer?: string }[]) : [];
      return (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            </Reveal>
            <div className="mt-8 divide-y divide-[var(--sf-border)] rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)]">
              {items.map((item, i) => (
                <details key={i} className="group p-5">
                  <summary className="cursor-pointer list-none font-medium [font-family:var(--sf-font-heading)]">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-sm text-[var(--sf-foreground)]/70">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "pricing":
      return (
        <section className="px-6 py-20">
          <Reveal className="mx-auto max-w-2xl rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-10 text-center shadow-[var(--sf-shadow-sm)]">
            <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            <p className="mt-3 text-[var(--sf-foreground)]/70">{str(c.note)}</p>
          </Reveal>
        </section>
      );

    case "cta": {
      const cta = c.cta as { label?: string; href?: string } | undefined;
      return (
        <section className="px-6 py-20">
          <Reveal className="mx-auto max-w-4xl rounded-[var(--sf-radius-xl)] bg-[var(--sf-primary)] px-8 py-14 text-center text-[var(--sf-background)] shadow-[var(--sf-shadow-lg)]">
            <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
            {str(c.description) ? <p className="mx-auto mt-3 max-w-lg opacity-80">{str(c.description)}</p> : null}
            {cta?.label ? (
              <Link
                href={resolveHref(cta.href || "#contact", ctx.basePath)}
                className="mt-7 inline-flex h-12 items-center rounded-[var(--sf-radius-md)] bg-[var(--sf-background)] px-6 font-medium text-[var(--sf-primary)] hover:opacity-90"
              >
                {cta.label}
              </Link>
            ) : null}
          </Reveal>
        </section>
      );
    }

    case "contact": {
      const profile = ctx.businessProfile;
      return (
        <section id="contact" className="px-6 py-20">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
              {str(c.description) ? <p className="mt-3 text-[var(--sf-foreground)]/70">{str(c.description)}</p> : null}
              <ul className="mt-6 space-y-3 text-sm">
                {profile.contact?.address ? (
                  <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--sf-accent)]" /> {profile.contact.address}</li>
                ) : null}
                {profile.contact?.phone ? (
                  <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-[var(--sf-accent)]" /> {profile.contact.phone}</li>
                ) : null}
                {profile.contact?.email ? (
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[var(--sf-accent)]" /> {profile.contact.email}</li>
                ) : null}
              </ul>
            </Reveal>
            <Reveal delay={0.05}>
              {ctx.forms[0] ? (
                <LeadForm form={ctx.forms[0]} onSubmit={ctx.onSubmitLead} />
              ) : (
                <Placeholder label="Formulaire de contact (à générer)" />
              )}
            </Reveal>
          </div>
        </section>
      );
    }

    case "form": {
      const formType = str(c.form_type);
      const form = ctx.forms.find((f) => f.type === formType) ?? ctx.forms[0];
      return (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-xl">
            <Reveal>
              <h2 className="text-3xl font-semibold [font-family:var(--sf-font-heading)]">{str(c.title)}</h2>
              {str(c.description) ? <p className="mt-3 text-[var(--sf-foreground)]/70">{str(c.description)}</p> : null}
            </Reveal>
            <Reveal delay={0.05} className="mt-6">
              {form ? <LeadForm form={form} onSubmit={ctx.onSubmitLead} /> : <Placeholder label="Formulaire (à générer)" />}
            </Reveal>
          </div>
        </section>
      );
    }

    case "footer": {
      const legalLinks = Array.isArray(c.legal_links) ? (c.legal_links as { label?: string; href?: string }[]) : [];
      const profile = ctx.businessProfile;
      return (
        <footer className="border-t border-[var(--sf-border)] px-6 py-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium [font-family:var(--sf-font-heading)]">{profile.company}</p>
              {str(c.tagline) ? <p className="mt-1 text-sm text-[var(--sf-foreground)]/60">{str(c.tagline)}</p> : null}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--sf-foreground)]/60">
              {legalLinks.map((l) => (
                <Link key={l.href} href={resolveHref(l.href, ctx.basePath)} className="hover:text-[var(--sf-foreground)]">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      );
    }

    default:
      return null;
  }
}
