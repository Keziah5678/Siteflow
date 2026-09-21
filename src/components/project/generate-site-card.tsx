"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";

export function GenerateSiteCard({
  projectId,
  hasPages,
  siteHref,
}: {
  projectId: string;
  hasPages: boolean;
  siteHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-site`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "La génération du site a échoué.");
      router.push(siteHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "La génération du site a échoué.");
    } finally {
      setLoading(false);
    }
  }

  if (hasPages) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Votre site est généré</CardTitle>
          <CardDescription>Continuez à l'affiner depuis l'éditeur de site.</CardDescription>
        </CardHeader>
        <CardContent>
          <LinkButton href={siteHref} variant="accent">
            Ouvrir l'éditeur de site
          </LinkButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle>Générer votre site</CardTitle>
        <CardDescription>
          L'IA planifie les pages, le design system et le contenu à partir de votre profil business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        ) : null}
        <Button onClick={handleGenerate} loading={loading} variant="accent">
          <Sparkles className="h-4 w-4" />
          Générer mon site
        </Button>
      </CardContent>
    </Card>
  );
}
