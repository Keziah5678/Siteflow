"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MoreHorizontal, Trash2, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hoverLift } from "@/lib/motion";
import { formatDate } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/lib/types";
import { deleteProject } from "@/lib/actions/projects";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Brouillon",
  generating: "Génération…",
  active: "Actif",
  archived: "Archivé",
};

const STATUS_TONE: Record<ProjectStatus, "neutral" | "accent" | "success"> = {
  draft: "neutral",
  generating: "accent",
  active: "success",
  archived: "neutral",
};

export function ProjectCard({
  project,
  workspaceSlug,
}: {
  project: Project;
  workspaceSlug: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <motion.div
      {...hoverLift}
      className="group relative flex flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]"
    >
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary">
            <Globe className="h-4 w-4" />
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-raised hover:text-foreground group-hover:opacity-100"
              aria-label="Options du projet"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-md)]"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <Link href={`/dashboard/${workspaceSlug}/projects/${project.slug}`} className="block">
          <h3 className="font-display text-base font-medium tracking-tight hover:text-accent">
            {project.name}
          </h3>
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">Créé le {formatDate(project.created_at)}</p>
      </div>
      <div className="mt-4">
        <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Supprimer ce projet ?"
        description={`« ${project.name} » et toutes ses données (site, prospects, versions) seront définitivement supprimés.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteProject(workspaceSlug, project.id);
                setConfirmOpen(false);
              })
            }
          >
            Supprimer définitivement
          </Button>
        </div>
      </Dialog>
    </motion.div>
  );
}
