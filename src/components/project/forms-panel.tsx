"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import type { ProjectForm } from "@/lib/types";

const TYPE_LABEL: Record<ProjectForm["type"], string> = {
  devis: "Demande de devis",
  "rendez-vous": "Prise de rendez-vous",
  contact: "Contact",
  intervention: "Demande d'intervention",
  information: "Demande d'information",
};

export function FormsPanel({ projectId, initialForms }: { projectId: string; initialForms: ProjectForm[] }) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/forms`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Échec de la génération des formulaires.");
      setForms(body.forms);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la génération des formulaires.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Formulaires</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Générés automatiquement selon votre secteur d'activité pour capter des prospects qualifiés.
          </p>
        </div>
        <Button onClick={regenerate} loading={loading} variant="outline">
          <RefreshCw className="h-4 w-4" />
          Régénérer
        </Button>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      {forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun formulaire pour le moment"
          description="Générez votre site ou cliquez sur « Régénérer » pour créer des formulaires adaptés."
        />
      ) : (
        <StaggerGroup className="grid gap-4 sm:grid-cols-2">
          {forms.map((form) => (
            <StaggerItem key={form.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{form.name}</CardTitle>
                    <Badge tone="accent">{TYPE_LABEL[form.type]}</Badge>
                  </div>
                  <CardDescription>{form.fields.length} champs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {form.fields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between text-sm">
                      <span>{field.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {field.type}
                        {field.required ? " · requis" : ""}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
}
