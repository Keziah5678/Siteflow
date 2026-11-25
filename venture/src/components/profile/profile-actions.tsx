"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { endorseAction, sendContactRequestAction, startConversationAction } from "@/lib/actions/social";

export function ContactActions({ userId, name, canMessage, pendingRequest, signedIn, autoOpen }: { userId: string; name: string; canMessage: boolean; pendingRequest: boolean; signedIn: boolean; autoOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen && !canMessage && !pendingRequest && signedIn);
  const [state, action] = useActionState(sendContactRequestAction, null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!signedIn) return <Button onClick={() => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)}><UserPlus /> Se connecter pour échanger</Button>;
  if (canMessage)
    return (
      <>
        <Button disabled={pending} onClick={() => start(async () => { const r = await startConversationAction(userId); if (r?.error) setErr(r.error); })}><MessageCircle /> Message</Button>
        {err && <p className="text-[12px] text-danger">{err}</p>}
      </>
    );
  if (pendingRequest || state?.ok) return <Button variant="success" disabled><Check /> Demande envoyée</Button>;
  return (
    <>
      <Button onClick={() => setOpen(true)}><UserPlus /> Demande de contact</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Contacter ${name}`} description="Si ta demande est acceptée, une conversation privée s'ouvrira.">
        <form action={action} className="space-y-4">
          <input type="hidden" name="to_id" value={userId} />
          <Field label="Message (facultatif)" htmlFor="cmsg"><Textarea id="cmsg" name="message" rows={3} maxLength={500} placeholder="Présente-toi et explique pourquoi tu souhaites échanger." /></Field>
          {state?.error && <Notice tone="danger">{state.error}</Notice>}
          <SubmitButton className="w-full">Envoyer la demande</SubmitButton>
        </form>
      </Dialog>
    </>
  );
}

export function EndorseForm({ recipientId, name, projects }: { recipientId: string; name: string; projects: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(endorseAction, null);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Recommander {name}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Recommander ${name}`} description="Les recommandations sont réservées aux personnes ayant travaillé ensemble sur un projet.">
        {state?.ok ? <Notice tone="success">{state.message}</Notice> : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="recipient_id" value={recipientId} />
            <Field label="Projet commun" htmlFor="eproj">
              <Select id="eproj" name="project_id">{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select>
            </Field>
            <Field label="Ta recommandation" htmlFor="ebody"><Textarea id="ebody" name="body" rows={4} minLength={10} maxLength={800} required /></Field>
            {state?.error && <Notice tone="danger">{state.error}</Notice>}
            <SubmitButton className="w-full">Publier</SubmitButton>
          </form>
        )}
      </Dialog>
    </>
  );
}
