import Link from "next/link";
import { Hand, Megaphone, Rocket } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** 30-second explanation for visitors. */
export function Intro() {
  const steps = [
    { icon: Megaphone, title: "Publie ton envie", text: "Un festival, une marque, un voyage, une startup… en une phrase." },
    { icon: Hand, title: "La communauté répond", text: "Des personnes s'y intéressent, participent ou proposent leurs compétences." },
    { icon: Rocket, title: "Réalisez-la ensemble", text: "Équipe, tâches, étapes, messagerie et VENTURE AI pour avancer." },
  ];
  return (
    <section className="v-glow mb-6 overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary-2">Dream. Connect. Build.</p>
      <h1 className="mt-3 max-w-lg text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">Ne regarde plus la vie des autres. Construis la tienne.</h1>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">VENTURE transforme les ambitions individuelles en réalisations collectives.</p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 sm:block">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-2">
              <s.icon className="size-[18px]" />
            </span>
            <span className="sm:mt-3 sm:block">
              <span className="block text-sm font-medium">
                {i + 1}. {s.title}
              </span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/signup" className={buttonClass("primary", "lg")}>Créer mon compte</Link>
        <Link href="/explore" className={buttonClass("secondary", "lg")}>Explorer les projets</Link>
      </div>
    </section>
  );
}
