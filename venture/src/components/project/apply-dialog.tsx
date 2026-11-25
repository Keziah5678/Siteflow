"use client";
import { useActionState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { applyAction } from "@/lib/actions/projects";

export function ApplyDialog({ open, onClose, projectId, title, skills, onDone }: { open: boolean; onClose: () => void; projectId: string; title: string; skills: string[]; onDone: () => void }) {
  const [state, action] = useActionState(applyAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <Dialog open={open} onClose={onClose} title="Je peux aider" description={title}>
      {state?.ok ? (
        <Notice tone="success" title="Candidature envoyée">L'équipe du projet va être notifiée. Tu recevras une notification à sa réponse.</Notice>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />
          {skills.length > 0 && (
            <Field label="Ce que tu apportes" htmlFor="skill">
              <Select id="skill" name="skill" defaultValue="">
                <option value="">Autre / plusieurs compétences</option>
                {skills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Message à l'équipe" htmlFor="message" error={state?.fields?.message} hint="Présente-toi, explique comment tu peux contribuer et tes disponibilités.">
            <Textarea id="message" name="message" required minLength={10} maxLength={1500} rows={5} />
          </Field>
          {state?.error && <Notice tone="danger">{state.error === "AUTH_REQUIRED" ? "Connecte-toi pour candidater." : state.error}</Notice>}
          <SubmitButton className="w-full" pendingLabel="Envoi…">Envoyer ma candidature</SubmitButton>
        </form>
      )}
    </Dialog>
  );
}
