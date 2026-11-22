import type { Metadata } from "next";
import { Section } from "@/components/marketing";
import { ContactForm } from "../contact/form";
import Demo from "./demo";

export const metadata: Metadata = { title: "Démonstration interactive", description: "Essayez RelancePro AI sur des prospects fictifs : analyse, priorisation, relance, respect des oppositions." };

export default function Page() {
  return (
    <>
      <Section eyebrow="Démonstration interactive" title="Essayez RelancePro AI" intro="Les prospects ci-dessous sont fictifs. Sélectionnez-en un, observez l'analyse et la relance proposée, puis testez l'analyse d'une réponse.">
        <Demo />
      </Section>
      <Section title="Vous préférez une démonstration personnalisée ?" intro="Décrivez votre activité : nous vous montrons RelancePro sur votre cas, en visio.">
        <div className="mx-auto max-w-2xl card p-6"><ContactForm kind="demo" /></div>
      </Section>
    </>
  );
}
