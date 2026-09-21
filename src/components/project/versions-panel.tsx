"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { formatDateTime } from "@/lib/utils";

interface VersionRow {
  id: string;
  label: string;
  created_at: string;
}

export function VersionsPanel({ projectId, initialVersions }: { projectId: string; initialVersions: VersionRow[] }) {
  const router = useRouter();
  const [versions] = useState(initialVersions);
  const [target, setTarget] = useState<VersionRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function restore(version: VersionRow) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/versions/${version.id}/restore`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "La restauration a échoué.");
        return;
      }
      setTarget(null);
      router.refresh();
    });
  }

  if (versions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Aucune version enregistrée"
        description="Chaque génération ou modification IA crée automatiquement une nouvelle version restaurable."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 lg:px-10">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Historique des versions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparez et revenez à une version précédente de votre site à tout moment.
        </p>
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      <StaggerGroup className="space-y-2">
        {versions.map((v, i) => (
          <StaggerItem key={v.id}>
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-medium">
                  {v.label} {i === 0 ? <span className="ml-1 text-xs text-accent">(actuelle)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
              </div>
              {i !== 0 ? (
                <Button variant="outline" size="sm" onClick={() => setTarget(v)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurer
                </Button>
              ) : null}
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <Dialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Restaurer cette version ?"
        description={`Le site actuel sera remplacé par « ${target?.label} ». Une nouvelle version sera créée pour que vous puissiez toujours revenir en arrière.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setTarget(null)}>
            Annuler
          </Button>
          <Button loading={pending} onClick={() => target && restore(target)}>
            Restaurer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
