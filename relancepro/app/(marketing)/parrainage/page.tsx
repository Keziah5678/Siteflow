import Link from "next/link";
import type { Metadata } from "next";
import { Section } from "@/components/marketing";

export const metadata: Metadata = { title: "Programme de parrainage", description: "Recommandez RelancePro à une entreprise de votre réseau." };

export default function Page() {
  return (
    <Section eyebrow="Parrainage" title="Recommandez RelancePro à une entreprise de votre réseau" intro="Chaque client dispose d'un lien de parrainage dans son espace (Paramètres → Parrainage).">
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3">
        {[["1. Partagez votre lien", "Copiez votre lien personnel depuis votre espace et envoyez-le à une entreprise que vous connaissez."], ["2. Elle s'inscrit", "L'inscription via votre lien est rattachée à votre compte. Vous suivez son statut dans votre espace."], ["3. Récompense", "Lorsque l'entreprise parrainée souscrit un abonnement, une récompense vous est attribuée selon les conditions du programme en vigueur, indiquées dans votre espace."]].map(([t, d]) => (
          <div key={t} className="card p-6"><h2 className="font-semibold">{t}</h2><p className="muted mt-2 text-sm">{d}</p></div>
        ))}
      </div>
      <p className="muted mx-auto mt-8 max-w-2xl text-center text-sm">Le parrainage repose sur une recommandation personnelle : n&apos;utilisez pas votre lien dans des envois de masse non sollicités.</p>
      <p className="mt-8 text-center"><Link href="/signup" className="btn btn-primary">Créer mon compte</Link></p>
    </Section>
  );
}
