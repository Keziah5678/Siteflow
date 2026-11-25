"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { CityInput } from "@/components/ui/city-input";
import { TagInput } from "@/components/ui/tag-input";
import { closeOpportunityAction, createOpportunityAction } from "@/lib/actions/social";
import { OPPORTUNITY_KINDS, SKILL_SUGGESTIONS } from "@/lib/constants";

export function OpportunityForm() {
  const [state, action] = useActionState(createOpportunityAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const f = state?.fields ?? {};
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="Type" htmlFor="okind"><Select id="okind" name="kind">{OPPORTUNITY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></Field>
      <Field label="Titre" htmlFor="otitle" error={f.title}><Input id="otitle" name="title" required minLength={4} maxLength={140} /></Field>
      <Field label="Description" htmlFor="odesc" error={f.description}><Textarea id="odesc" name="description" rows={5} required minLength={20} maxLength={4000} /></Field>
      <Field label="Compétences" htmlFor="oskills"><TagInput id="oskills" name="skills" suggestions={SKILL_SUGGESTIONS} max={15} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ville" htmlFor="ocity"><CityInput id="ocity" name="city" /></Field>
        <Field label="Rémunération / conditions" htmlFor="ocomp"><Input id="ocomp" name="compensation" maxLength={120} placeholder="Ex. : 400 €/jour" /></Field>
      </div>
      <Checkbox name="is_remote" label="Possible à distance" />
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton>Publier</SubmitButton>
    </form>
  );
}

export function OpportunityToggle({ id, open }: { id: string; open: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await closeOpportunityAction(id, !open)))}>
      {open ? "Clôturer" : "Rouvrir"}
    </Button>
  );
}
