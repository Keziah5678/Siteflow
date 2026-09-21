import { AlertTriangle } from "lucide-react";

export function NotConfiguredNotice() {
  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-warning/30 bg-warning/5 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-lg font-medium">Supabase n'est pas configuré</h1>
        <p className="text-sm text-muted-foreground">
          Renseignez <code className="rounded bg-surface-raised px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          et <code className="rounded bg-surface-raised px-1 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          dans <code className="rounded bg-surface-raised px-1 py-0.5">.env.local</code> pour activer
          l'authentification. Voir <code className="rounded bg-surface-raised px-1 py-0.5">.env.example</code>{" "}
          et le README.
        </p>
      </div>
    </div>
  );
}
