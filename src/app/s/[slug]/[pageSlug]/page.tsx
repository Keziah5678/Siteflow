import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSite } from "@/lib/site/get-public-site";
import { PublicSiteView } from "@/components/site-renderer/public-site-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  const page = site?.pages.find((p) => p.slug === pageSlug);
  if (!site || !page) return {};
  return {
    title: page.seo?.title || `${page.title} · ${site.businessProfile.company}`,
    description: page.seo?.description || undefined,
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();

  const page = site.pages.find((p) => p.slug === pageSlug);
  if (!page) notFound();

  const navLinks = site.pages
    .sort((a, b) => a.nav_order - b.nav_order)
    .map((p) => ({ label: p.title, href: p.is_home ? `/s/${slug}` : `/s/${slug}/${p.slug}` }));

  return (
    <PublicSiteView
      projectId={site.website.project_id}
      page={page}
      navLinks={navLinks}
      businessProfile={site.businessProfile}
      designSystem={site.designSystem}
      forms={site.forms}
      basePath={`/s/${slug}`}
    />
  );
}
