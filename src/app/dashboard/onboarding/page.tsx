"use client";

import { useState, useTransition } from "react";
import { Sprout, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createWorkspace } from "@/lib/actions/workspaces";
import { fadeUp } from "@/lib/motion";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    startTransition(async () => {
      const result = await createWorkspace(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        variants={fadeUp("balanced")}
        initial="hidden"
        animate="show"
        className="w-full max-w-md space-y-8"
      >
        <div className="space-y-3 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground">
            <Sprout className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl font-medium">Bienvenue sur Seedflow</h1>
          <p className="text-sm text-muted-foreground">
            Donnez un nom à votre espace de travail. Vous pourrez y créer autant de projets que
            nécessaire.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom de l'espace de travail</Label>
            <Input
              id="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon agence, Mon entreprise…"
            />
          </div>
          {error ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={pending}>
            Continuer
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
