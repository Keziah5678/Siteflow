import { getPublicSite } from "@/lib/site/get-public-site";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  const origin = new URL(request.url).origin;

  const body = site
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/s/${slug}/sitemap.xml`
    : `User-agent: *\nDisallow: /`;

  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
