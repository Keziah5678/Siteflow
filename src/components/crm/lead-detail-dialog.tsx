"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Building2, Calendar } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { LEAD_STATUSES } from "@/lib/crm-constants";
import type { Lead } from "@/lib/types";

export function LeadDetailDialog({
  lead,
  open,
  onClose,
  onUpdated,
}: {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (lead: Lead) => void;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (!lead) return null;

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/leads/${lead!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) onUpdated(data.lead);
  }

  return (
    <Dialog open={open} onClose={onClose} title={lead.name || "Prospect"} description={lead.company ?? undefined} className="max-w-lg">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {lead.email ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {lead.email}
            </div>
          ) : null}
          {lead.phone ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {lead.phone}
            </div>
          ) : null}
          {lead.company ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> {lead.company}
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> {formatDateTime(lead.created_at)}
          </div>
        </div>

        {lead.message ? (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-raised p-3 text-sm">
            {lead.message}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Statut</label>
          <Select
            value={lead.status}
            onChange={(e) => startTransition(() => patch({ status: e.target.value }))}
            disabled={pending}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <div className="max-h-32 space-y-2 overflow-y-auto scrollbar-thin">
            {(lead.notes ?? []).map((n) => (
              <div key={n.id} className="rounded-[var(--radius-sm)] bg-surface-raised px-2.5 py-1.5 text-xs">
                <p>{n.body}</p>
                <p className="mt-0.5 text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
            ))}
            {(lead.notes ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune note pour le moment.</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajouter une note…"
              className="min-h-9"
              rows={1}
            />
            <Button
              type="button"
              variant="outline"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  await patch({ note });
                  setNote("");
                })
              }
              disabled={!note.trim()}
            >
              Ajouter
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
