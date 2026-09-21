"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Page, Website } from "@/lib/types";

export function SeoPanel({
  projectId,
  website,
  pages,
  publicOrigin,
}: {
  projectId: string;
  website: Website;
  pages: Page[];
  publicOrigin: string;
}) {
  const router = useRouter();
  const [siteTitle, setSiteTitle] = useState(website.global_seo?.site_title ?? "");
  const [siteDescription, setSiteDescription] = useState(website.global_seo?.site_description ?? "");
  const [pageSeo, setPageSeo] = useState<Record<string, { title: string; description: string }>>(
    Object.fromEntries(pages.map((p) => [p.id, { title: p.seo?.title ?? "", description: p.seo?.description ?? "" }])),
  );
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPage, setSavingPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const publicUrl = website.public_slug ? `${publicOrigin}/s/${website.public_slug}` : null;

  async function saveGlobal() {
    setSavingGlobal(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/seo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ global_seo: { site_title: siteTitle, site_description: siteDescription } }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Échec de l'enregistrement.");
      setSaved("global");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSavingGlobal(false);
    }
  }

  async function savePage(pageId: string) {
    setSavingPage(pageId);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seo: pageSeo[pageId] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Échec de l'enregistrement.");
      setSaved(pageId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSavingPage(null);
    }
  }

  async function togglePublish() {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/seo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: website.status === "published" ? "draft" : "published" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Échec de la mise à jour.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la mise à jour.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">SEO</h1>
          <p className="mt-1 text-sm text-muted-foreground">Référencement et publication de votre site.</p>
        </div>
        <Badge tone={website.status === "published" ? "success" : "neutral"}>
          {website.status === "published" ? "Publié" : "Brouillon"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publication</CardTitle>
          <CardDescription>
            {publicUrl ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                {publicUrl} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "Générez votre site pour obtenir une adresse publique."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant={website.status === "published" ? "outline" : "accent"} onClick={togglePublish}>
            {website.status === "published" ? "Dépublier" : "Publier"}
          </Button>
          {publicUrl ? (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <a href={`${publicUrl}/sitemap.xml`} target="_blank" rel="noreferrer" className="hover:text-foreground">
                sitemap.xml
              </a>
              <a href={`${publicUrl}/robots.txt`} target="_blank" rel="noreferrer" className="hover:text-foreground">
                robots.txt
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO global</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="site-title">Titre du site</Label>
            <Input id="site-title" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} maxLength={70} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-description">Description</Label>
            <Textarea id="site-description" value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} maxLength={180} />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" loading={savingGlobal} onClick={saveGlobal}>
              Enregistrer
            </Button>
            {saved === "global" ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Enregistré
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO par page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {pages.map((page) => (
            <div key={page.id} className="space-y-2 border-b border-border pb-5 last:border-0 last:pb-0">
              <p className="text-sm font-medium">{page.title}</p>
              <Input
                value={pageSeo[page.id]?.title ?? ""}
                onChange={(e) => setPageSeo((s) => ({ ...s, [page.id]: { ...s[page.id], title: e.target.value } }))}
                placeholder="Titre SEO"
                maxLength={70}
              />
              <Textarea
                value={pageSeo[page.id]?.description ?? ""}
                onChange={(e) => setPageSeo((s) => ({ ...s, [page.id]: { ...s[page.id], description: e.target.value } }))}
                placeholder="Meta description"
                maxLength={180}
                className="min-h-16"
              />
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" loading={savingPage === page.id} onClick={() => savePage(page.id)}>
                  Enregistrer
                </Button>
                {saved === page.id ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="h-3.5 w-3.5" /> Enregistré
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}
