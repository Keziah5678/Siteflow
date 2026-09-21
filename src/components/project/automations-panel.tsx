"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Workflow, Plus, Trash2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import type { Automation } from "@/lib/types";

const TRIGGERS = [
  { value: "nouveau_prospect", label: "Nouveau prospect reçu" },
  { value: "devis_soumis", label: "Formulaire de devis soumis" },
  { value: "prospect_qualifie", label: "Prospect qualifié par l'IA" },
];

const ACTIONS = [
  { value: "notifier_email", label: "M'envoyer une notification par email" },
  { value: "notifier_webhook", label: "Appeler un webhook (Slack, Zapier…)" },
];

export function AutomationsPanel({ projectId, initial }: { projectId: string; initial: Automation[] }) {
  const router = useRouter();
  const [automations, setAutomations] = useState(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(TRIGGERS[0].value);
  const [action, setAction] = useState(ACTIONS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, trigger, action }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Échec de la création.");
        return;
      }
      setAutomations((a) => [body.automation, ...a]);
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  function toggle(automation: Automation) {
    startTransition(async () => {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !automation.enabled }),
      });
      const body = await res.json();
      if (res.ok) setAutomations((a) => a.map((x) => (x.id === automation.id ? body.automation : x)));
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
      if (res.ok) setAutomations((a) => a.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Automatisations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Déclenchez des actions automatiquement selon l'activité de votre site.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle automatisation
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        L'automatisation est enregistrée et activable, mais son exécution réelle (envoi d'email, appel webhook) nécessite de
        connecter un fournisseur d'envoi — voir « À faire par le propriétaire » dans le README.
      </div>

      {automations.length === 0 ? (
        <EmptyState icon={Workflow} title="Aucune automatisation" description="Créez votre première automatisation pour réagir aux nouveaux prospects." />
      ) : (
        <StaggerGroup className="space-y-2">
          {automations.map((a) => (
            <StaggerItem key={a.id}>
              <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-4">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGERS.find((t) => t.value === a.trigger)?.label ?? a.trigger} →{" "}
                    {ACTIONS.find((x) => x.value === a.action)?.label ?? a.action}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "Actif" : "Inactif"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => toggle(a)} disabled={pending}>
                    {a.enabled ? "Désactiver" : "Activer"}
                  </Button>
                  <button
                    onClick={() => remove(a.id)}
                    className="focus-ring rounded-[var(--radius-sm)] p-1.5 text-muted-foreground hover:text-danger"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Nouvelle automatisation">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Alerte nouveau devis" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Déclencheur</Label>
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
          {error ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create} loading={pending} disabled={!name.trim()}>
              Créer
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
