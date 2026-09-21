import { getPublicSite } from "@/lib/site/get-public-site";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const urls = site.pages
    .map((p) => {
      const loc = p.is_home ? `${origin}/s/${slug}` : `${origin}/s/${slug}/${p.slug}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
