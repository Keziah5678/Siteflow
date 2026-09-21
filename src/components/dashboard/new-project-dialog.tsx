"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createProject } from "@/lib/actions/projects";

export function NewProjectDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    startTransition(async () => {
      const result = await createProject(workspaceSlug, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nouveau projet
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau projet"
        description="Donnez un nom à votre projet. Vous détaillerez votre activité juste après."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Nom du projet</Label>
            <Input
              id="project-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Salon de coiffure Lumière"
            />
          </div>
          {error ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              Créer le projet
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
