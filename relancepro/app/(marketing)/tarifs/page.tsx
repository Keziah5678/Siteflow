import type { Metadata } from "next";
import { Faq, PricingCards, Section, TrialNote } from "@/components/marketing";

export const metadata: Metadata = { title: "Tarifs", description: "Starter 79 €, Pro 149 €, Business 299 € HT par mois. Essai gratuit de 7 jours, sans engagement." };

export default function Page() {
  return (
    <>
      <Section eyebrow="Tarifs" title="Choisissez la formule qui vous ressemble" intro="Tous les prix sont hors taxes, par entreprise et par mois. Changez de formule ou résiliez à tout moment depuis votre espace.">
        <PricingCards />
        <TrialNote />
      </Section>
      <Section title="Questions sur la facturation"><Faq /></Section>
    </>
  );
}
