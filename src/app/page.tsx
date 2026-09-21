import Link from "next/link";
import { ArrowRight, Sprout, Sparkles, LayoutTemplate, Users, LineChart } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/Reveal";
import { LinkButton } from "@/components/ui/button";

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: "Positionnement & offre",
    description:
      "Un questionnaire intelligent transforme votre idée en profil business structuré : activité, cible, positionnement, ton.",
  },
  {
    icon: LayoutTemplate,
    title: "Site généré et pilotable",
    description:
      "Pages, sections, design system et SEO générés à partir de votre profil — puis ajustés en conversant avec l'IA.",
  },
  {
    icon: Users,
    title: "Prospects & CRM",
    description:
      "Formulaires adaptés à votre secteur, prospects centralisés, pipeline de suivi jusqu'à la vente.",
  },
  {
    icon: LineChart,
    title: "Audit & optimisation continue",
    description:
      "Design, SEO, accessibilité, performance et conversion analysés automatiquement, avec corrections proposées.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-medium">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
            <Sprout className="h-4 w-4" />
          </span>
          Seedflow
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Connexion
          </Link>
          <LinkButton href="/signup" size="sm">
            Commencer
            <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 py-20 text-center lg:py-28">
        <Reveal>
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Votre opérateur IA de création d'activité
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
            D'une idée à un véritable système commercial, en un seul flux.
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
            Seedflow construit votre positionnement, votre offre, votre identité, votre site internet
            et votre système de génération de prospects — puis les fait évoluer avec vous, par simple
            conversation.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/signup" size="lg">
              Créer mon premier projet
              <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton href="/login" size="lg" variant="outline">
              J'ai déjà un compte
            </LinkButton>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24 lg:px-10">
        <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((cap) => (
            <StaggerItem key={cap.title}>
              <div className="h-full rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary">
                  <cap.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-base font-medium">{cap.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{cap.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row lg:px-10">
          <span>© {new Date().getFullYear()} Seedflow. Tous droits réservés.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Connexion
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Créer un compte
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
