"use client";
import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { reportAction } from "@/lib/actions/social";
import { REPORT_REASONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ReportButton({ targetType, targetId, label = "Signaler", className, iconOnly = false }: { targetType: "project" | "comment" | "message" | "profile" | "opportunity"; targetId: string; label?: string; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportAction, null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1.5 text-[13px] text-subtle hover:text-danger", className)} aria-label={label} title={label}>
        <Flag className="size-3.5" />
        {!iconOnly && label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Signaler un contenu" description="Les signalements sont examinés par l'équipe de modération. Ton identité n'est pas communiquée à la personne signalée.">
        {state?.ok ? (
          <Notice tone="success">{state.message}</Notice>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="target_type" value={targetType} />
            <input type="hidden" name="target_id" value={targetId} />
            <Field label="Motif" htmlFor="reason">
              <Select id="reason" name="reason" required defaultValue="">
                <option value="" disabled>Choisir…</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Détails (facultatif)" htmlFor="details">
              <Textarea id="details" name="details" maxLength={1000} rows={3} />
            </Field>
            {state?.error && <Notice tone="danger">{state.error === "AUTH_REQUIRED" ? "Connecte-toi pour signaler un contenu." : state.error}</Notice>}
            <SubmitButton variant="danger" className="w-full">Envoyer le signalement</SubmitButton>
          </form>
        )}
      </Dialog>
    </>
  );
}
