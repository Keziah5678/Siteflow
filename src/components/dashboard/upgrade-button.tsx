"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error || "Impossible de démarrer le paiement.");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de démarrer le paiement.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} loading={loading} variant="accent">
        Passer au plan Pro
      </Button>
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}
