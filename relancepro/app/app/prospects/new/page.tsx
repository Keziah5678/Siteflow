import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth/session";
import { Flash, PageHeader } from "@/components/ui";
import { ProspectForm } from "../form";
import { createProspectAction } from "../../actions";

export const metadata: Metadata = { title: "Nouveau prospect" };

export default async function Page({ searchParams }: PageProps<"/app/prospects/new">) {
  await requireContext();
  const sp = await searchParams;
  return (
    <>
      <Link href="/app/prospects" className="muted text-sm hover:underline">← Prospects</Link>
      <PageHeader title="Nouveau prospect" subtitle="Un e-mail ou un téléphone, et un nom ou une entreprise suffisent." />
      <Flash error={typeof sp.error === "string" ? sp.error : null} />
      <div className="card p-6"><ProspectForm action={createProspectAction} submitLabel="Ajouter le prospect" /></div>
    </>
  );
}
