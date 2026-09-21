import type { LeadStatus } from "@/lib/types";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "nouveau", label: "Nouveau" },
  { value: "contacte", label: "Contacté" },
  { value: "qualifie", label: "Qualifié" },
  { value: "rendez-vous", label: "Rendez-vous" },
  { value: "proposition", label: "Proposition" },
  { value: "gagne", label: "Gagné" },
  { value: "perdu", label: "Perdu" },
];

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}
