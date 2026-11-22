import type { Metadata } from "next";
import { Section } from "@/components/marketing";
import { ContactForm } from "./form";

export const metadata: Metadata = { title: "Contact", description: "Contactez l'équipe RelancePro." };

export default function Page() {
  return (
    <Section eyebrow="Contact" title="Parlons de vos demandes oubliées" intro="Une question sur le produit, la facturation ou la conformité ? Écrivez-nous.">
      <div className="mx-auto max-w-2xl card p-6"><ContactForm kind="contact" /></div>
    </Section>
  );
}
