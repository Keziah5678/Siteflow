"use client";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/primitives";
import { deleteProjectAction } from "@/lib/actions/projects";

export function DeleteProjectButton({ projectId, title }: { projectId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}><Trash2 /> Supprimer</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Supprimer définitivement ?" description={`Tape SUPPRIMER pour confirmer la suppression de « ${title} ».`}>
        <div className="space-y-4">
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirmation" placeholder="SUPPRIMER" />
          {error && <Notice tone="danger">{error}</Notice>}
          <Button variant="danger" className="w-full" disabled={confirm !== "SUPPRIMER" || pending} onClick={() => start(async () => { const r = await deleteProjectAction(projectId); if (r?.error) setError(r.error); })}>
            Supprimer le projet
          </Button>
        </div>
      </Dialog>
    </>
  );
}
