"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DesignSystemProvider } from "@/components/site-renderer/design-system-provider";
import { ANIMATION_INTENSITIES } from "@/lib/constants";
import type { DesignSystem } from "@/lib/types";

const COLOR_FIELDS: { key: keyof DesignSystem["colors"]; label: string }[] = [
  { key: "primary", label: "Primaire" },
  { key: "secondary", label: "Secondaire" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Fond" },
  { key: "surface", label: "Surface" },
  { key: "foreground", label: "Texte" },
  { key: "muted", label: "Atténué" },
  { key: "border", label: "Bordure" },
];

export function DesignEditor({ projectId, initial }: { projectId: string; initial: DesignSystem }) {
  const router = useRouter();
  const [ds, setDs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(patch: Partial<DesignSystem>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/design-system`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Échec de l'enregistrement.");
      setDs(body.designSystem);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  function setColor(key: keyof DesignSystem["colors"], value: string) {
    const colors = { ...ds.colors, [key]: value };
    setDs((d) => ({ ...d, colors }));
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1fr_380px] lg:px-10">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Design</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustez le design system de votre site. Chaque changement se propage à toutes les pages.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Couleurs</CardTitle>
            <CardDescription>Codes hexadécimaux appliqués à l'ensemble du site.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COLOR_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    id={f.key}
                    type="color"
                    value={ds.colors[f.key]}
                    onChange={(e) => setColor(f.key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border"
                  />
                  <span className="truncate text-xs text-muted-foreground">{ds.colors[f.key]}</span>
                </div>
              </div>
            ))}
          </CardContent>
          <div className="flex justify-end px-6 pb-6">
            <Button size="sm" variant="outline" loading={saving} onClick={() => save({ colors: ds.colors })}>
              Enregistrer les couleurs
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Style</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Espacement</Label>
              <Select
                value={ds.spacing_scale}
                onChange={(e) => save({ spacing_scale: e.target.value as DesignSystem["spacing_scale"] })}
              >
                <option value="tight">Compact</option>
                <option value="regular">Standard</option>
                <option value="airy">Aéré</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rayons des angles</Label>
              <Select value={ds.radii} onChange={(e) => save({ radii: e.target.value as DesignSystem["radii"] })}>
                <option value="sharp">Nets</option>
                <option value="soft">Doux</option>
                <option value="round">Arrondis</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ombres</Label>
              <Select value={ds.shadows} onChange={(e) => save({ shadows: e.target.value as DesignSystem["shadows"] })}>
                <option value="none">Aucune</option>
                <option value="subtle">Discrètes</option>
                <option value="elevated">Marquées</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Style de boutons</Label>
              <Select
                value={ds.button_style}
                onChange={(e) => save({ button_style: e.target.value as DesignSystem["button_style"] })}
              >
                <option value="solid">Plein</option>
                <option value="outline">Contour</option>
                <option value="soft">Doux</option>
                <option value="minimal">Minimal</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Animations</CardTitle>
            <CardDescription>Intensité des animations appliquées sur l'ensemble du site.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={ds.animation_intensity}
              onChange={(e) => save({ animation_intensity: e.target.value as DesignSystem["animation_intensity"] })}
            >
              {ANIMATION_INTENSITIES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        ) : null}
        {saved ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <Check className="h-4 w-4" /> Enregistré — visible immédiatement sur le site.
          </p>
        ) : null}
      </div>

      <div className="sticky top-6 h-fit rounded-[var(--radius-lg)] border border-border p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Aperçu</p>
        <DesignSystemProvider designSystem={ds} className="rounded-[var(--radius-md)] p-6">
          <p className="mb-2 text-xs" style={{ color: ds.colors.muted }}>
            Aperçu du design
          </p>
          <h3 className="mb-2 text-xl font-semibold [font-family:var(--sf-font-heading)]">Titre d'exemple</h3>
          <p className="mb-4 text-sm [font-family:var(--sf-font-body)]" style={{ color: ds.colors.foreground }}>
            Voici un aperçu de vos choix de couleurs et de typographie appliqués à un texte courant.
          </p>
          <button
            className="rounded-[var(--sf-radius-md)] px-4 py-2 text-sm font-medium shadow-[var(--sf-shadow-sm)]"
            style={{ backgroundColor: ds.colors.primary, color: ds.colors.background }}
          >
            Bouton d'action
          </button>
        </DesignSystemProvider>
      </div>
    </div>
  );
}
