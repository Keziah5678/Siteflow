import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="v-glow flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Cette page n'existe pas</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Le contenu a peut-être été supprimé, ou tu n'as pas l'autorisation d'y accéder.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-6")}>Retour à l'accueil</Link>
    </main>
  );
}
