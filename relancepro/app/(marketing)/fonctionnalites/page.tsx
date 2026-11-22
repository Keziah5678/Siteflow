import Link from "next/link";
import type { Metadata } from "next";
import { Section } from "@/components/marketing";
import { FEATURES } from "@/lib/content";

export const metadata: Metadata = { title: "Fonctionnalités", description: "Détection des demandes oubliées, analyse IA, relances factuelles, séquences, conformité RGPD, import CSV, webhooks." };

export default function Page() {
  return (
    <Section eyebrow="Fonctionnalités" title="Un assistant commercial qui ne laisse rien passer" intro="RelancePro réunit ce dont une PME a besoin pour suivre ses demandes et ses devis, avec des garde-fous à chaque étape.">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(f => <div key={f.title} className="card p-6"><div className="text-2xl text-brand-500" aria-hidden>{f.icon}</div><h2 className="mt-3 font-semibold">{f.title}</h2><p className="muted mt-2 text-sm leading-relaxed">{f.text}</p></div>)}
      </div>
      <div className="card mt-10 p-6">
        <h2 className="text-lg font-semibold">Intégrations</h2>
        <ul className="muted mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li><strong className="text-[var(--text)]">Disponibles :</strong> envoi par votre messagerie (SMTP), import et export CSV, formulaire de votre site, webhooks signés, paiement Stripe.</li>
          <li><strong className="text-[var(--text)]">En préparation :</strong> connexion Gmail et Outlook par autorisation OAuth, agendas Google et Microsoft, connecteurs CRM. Nous indiquons clairement ce qui est actif dans votre espace.</li>
        </ul>
      </div>
      <p className="mt-10 text-center"><Link href="/signup" className="btn btn-primary btn-lg">Essayer gratuitement</Link></p>
    </Section>
  );
}
