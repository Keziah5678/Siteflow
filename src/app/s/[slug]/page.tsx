import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSite } from "@/lib/site/get-public-site";
import { PublicSiteView } from "@/components/site-renderer/public-site-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return {};
  return {
    title: site.website.global_seo?.site_title || site.businessProfile.company,
    description: site.website.global_seo?.site_description || undefined,
  };
}

export default async function PublicHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();

  const homePage = site.pages.find((p) => p.is_home) ?? site.pages[0];
  const navLinks = site.pages
    .sort((a, b) => a.nav_order - b.nav_order)
    .map((p) => ({ label: p.title, href: p.is_home ? `/s/${slug}` : `/s/${slug}/${p.slug}` }));

  return (
    <PublicSiteView
      projectId={site.website.project_id}
      page={homePage}
      navLinks={navLinks}
      businessProfile={site.businessProfile}
      designSystem={site.designSystem}
      forms={site.forms}
      basePath={`/s/${slug}`}
    />
  );
}
