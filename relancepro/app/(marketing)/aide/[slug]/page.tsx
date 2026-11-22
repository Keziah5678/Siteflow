import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Prose } from "@/components/marketing";
import { ARTICLES } from "@/lib/content";

export function generateStaticParams() { return ARTICLES.map(a => ({ slug: a.slug })); }

export async function generateMetadata({ params }: PageProps<"/aide/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLES.find(x => x.slug === slug);
  return a ? { title: a.title } : {};
}

export default async function Page({ params }: PageProps<"/aide/[slug]">) {
  const { slug } = await params;
  const a = ARTICLES.find(x => x.slug === slug);
  if (!a) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 pt-16">
      <Link href="/aide" className="muted text-sm hover:underline">← Centre d&apos;aide</Link>
      <p className="mt-6 text-sm font-semibold text-brand-500">{a.category}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{a.title}</h1>
      <div className="mt-6"><Prose blocks={a.body} /></div>
    </article>
  );
}
