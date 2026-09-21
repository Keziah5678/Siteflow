"use client";

import { useMemo, useState } from "react";
import { Search, Mail, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadDetailDialog } from "@/components/crm/lead-detail-dialog";
import { LEAD_STATUSES } from "@/lib/crm-constants";
import { formatDate } from "@/lib/utils";
import { hoverLift } from "@/lib/motion";
import { Users } from "lucide-react";
import type { Lead } from "@/lib/types";

export function LeadsBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.email, l.phone, l.company, l.message].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [leads, query]);

  function handleUpdated(updated: Lead) {
    setLeads((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
    setSelected(updated);
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun prospect pour le moment"
        description="Les demandes envoyées via vos formulaires apparaîtront automatiquement ici."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un prospect…" className="pl-9" />
        </div>
      </div>
      <div className="flex-1 overflow-x-auto p-4">
        <div className="grid h-full grid-flow-col auto-cols-[260px] gap-4">
          {LEAD_STATUSES.map((status) => {
            const columnLeads = filtered.filter((l) => l.status === status.value);
            return (
              <div key={status.value} className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface-raised">
                <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                  <span className="text-sm font-medium">{status.label}</span>
                  <span className="text-xs text-muted-foreground">{columnLeads.length}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
                  {columnLeads.map((lead) => (
                    <motion.button
                      key={lead.id}
                      {...hoverLift}
                      onClick={() => setSelected(lead)}
                      className="w-full rounded-[var(--radius-md)] border border-border bg-surface p-3 text-left shadow-[var(--shadow-sm)]"
                    >
                      <p className="text-sm font-medium">{lead.name || "Sans nom"}</p>
                      {lead.email ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </p>
                      ) : null}
                      {lead.phone ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {lead.phone}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{formatDate(lead.created_at)}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <LeadDetailDialog lead={selected} open={Boolean(selected)} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
    </div>
  );
}
