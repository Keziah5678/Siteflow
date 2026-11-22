import { requireContext } from "@/lib/auth/session";
import { listProspects, STATUS_LABEL, type Status } from "@/lib/app/prospects";
import { toCsv } from "@/lib/prospects/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ctx } = await requireContext();
  const rows = await listProspects(ctx, { sort: "recent" });
  const csv = toCsv(rows.map(p => ({
    prenom: p.firstName, nom: p.lastName, entreprise: p.company, email: p.email, telephone: p.phone, statut: STATUS_LABEL[p.status as Status],
    besoin: p.need, valeur_estimee_eur: p.estimatedValueCents ? Number(p.estimatedValueCents) / 100 : "", base_legale: p.lawfulBasis ?? "", source: p.source,
    cree_le: (p.createdAt as Date).toISOString()
  })));
  return new Response(csv || "﻿", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="prospects-relancepro-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
