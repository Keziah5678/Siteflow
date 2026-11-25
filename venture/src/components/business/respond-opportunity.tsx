"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { respondOpportunityAction } from "@/lib/actions/social";

export function RespondOpportunity({ opportunityId, signedIn, responded }: { opportunityId: string; signedIn: boolean; responded: boolean }) {
  const [state, action] = useActionState(respondOpportunityAction, null);
  if (!signedIn) return <p className="text-sm"><Link href={`/login?next=/opportunities/${opportunityId}`} className="text-primary-2 hover:underline">Connecte-toi</Link> pour répondre.</p>;
  if (responded || state?.ok) return <Notice tone="success">Ta réponse a été transmise à l'entreprise.</Notice>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <Field label="Ta réponse" htmlFor="omsg"><Textarea id="omsg" name="message" rows={4} minLength={10} maxLength={1500} required placeholder="Présente ton expérience et ce que tu proposes." /></Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton>Répondre</SubmitButton>
    </form>
  );
}
