"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Vérifie ta connexion puis réessaie.{error.digest ? ` (réf. ${error.digest})` : ""}</p>
      <Button className="mt-6" onClick={reset}>Réessayer</Button>
    </main>
  );
}
