import type { MetadataRoute } from "next";
import { ARTICLES, SECTORS } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const paths = ["", "/fonctionnalites", "/tarifs", "/comment-ca-marche", "/demo", "/aide", "/contact", "/parrainage", "/mentions-legales", "/confidentialite", "/conditions", "/cookies",
    ...SECTORS.map(s => `/secteurs/${s.slug}`), ...ARTICLES.map(a => `/aide/${a.slug}`)];
  return paths.map(p => ({ url: `${base}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.6 }));
}
