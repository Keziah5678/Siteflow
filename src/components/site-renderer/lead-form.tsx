"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { ProjectForm } from "@/lib/types";

export function LeadForm({
  form,
  onSubmit,
}: {
  form: ProjectForm;
  onSubmit?: (formId: string, values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;
    setStatus("loading");
    setError(null);
    try {
      await onSubmit(form.id, values);
      setStatus("success");
      setValues({});
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-8 text-center shadow-[var(--sf-shadow-sm)]">
        <CheckCircle2 className="h-8 w-8 text-[var(--sf-accent)]" />
        <p className="font-medium [font-family:var(--sf-font-heading)]">Merci, votre demande a bien été envoyée.</p>
        <p className="text-sm text-[var(--sf-foreground)]/60">Nous reviendrons vers vous rapidement.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-6 shadow-[var(--sf-shadow-sm)]"
    >
      {form.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <label htmlFor={field.id} className="text-sm font-medium">
            {field.label}
            {field.required ? " *" : ""}
          </label>
          {field.type === "textarea" ? (
            <textarea
              id={field.id}
              required={field.required}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              className="min-h-24 w-full rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-background)] px-3 py-2 text-sm outline-none focus:border-[var(--sf-accent)]"
            />
          ) : field.type === "select" ? (
            <select
              id={field.id}
              required={field.required}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              className="h-10 w-full rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-background)] px-3 text-sm outline-none focus:border-[var(--sf-accent)]"
            >
              <option value="">Sélectionner…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : field.type === "checkbox" ? (
            <input
              id={field.id}
              type="checkbox"
              checked={values[field.id] === "true"}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: String(e.target.checked) }))}
              className="h-4 w-4"
            />
          ) : (
            <input
              id={field.id}
              type={field.type}
              required={field.required}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              className="h-10 w-full rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-background)] px-3 text-sm outline-none focus:border-[var(--sf-accent)]"
            />
          )}
        </div>
      ))}
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "loading" || !onSubmit}
        className="h-11 w-full rounded-[var(--sf-radius-md)] bg-[var(--sf-primary)] font-medium text-[var(--sf-background)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {onSubmit ? (status === "loading" ? "Envoi…" : "Envoyer") : "Envoi désactivé en aperçu"}
      </button>
    </form>
  );
}
