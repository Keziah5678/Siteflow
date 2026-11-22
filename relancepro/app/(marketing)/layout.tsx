import Link from "next/link";
import { Logo } from "@/components/ui";
import { PageView, ThemeToggle } from "@/components/client";
import { SECTORS } from "@/lib/content";
import { currentUser } from "@/lib/auth/session";

const NAV = [
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/comment-ca-marche", label: "Comment ça marche" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/demo", label: "Démo" },
  { href: "/aide", label: "Aide" }
];

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">Aller au contenu</a>
      <header className="sticky top-0 z-40 border-b line bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="RelancePro, accueil"><Logo /></Link>
          <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
            {NAV.map(n => <Link key={n.href} href={n.href} className="btn btn-ghost btn-sm">{n.label}</Link>)}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user ? <Link href="/app" className="btn btn-primary btn-sm">Mon espace</Link> : <>
              <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">Connexion</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Essai gratuit</Link>
            </>}
          </div>
        </div>
        <nav aria-label="Navigation mobile" className="flex gap-1 overflow-x-auto border-t line px-3 py-1.5 md:hidden">
          {NAV.map(n => <Link key={n.href} href={n.href} className="btn btn-ghost btn-sm shrink-0">{n.label}</Link>)}
        </nav>
      </header>
      <main id="contenu">{children}</main>
      <footer className="mt-24 border-t line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3"><Logo /><p className="muted text-sm">L&apos;intelligence artificielle qui transforme les prospects oubliés en opportunités commerciales.</p><p className="muted text-xs">Logiciel conçu en France pour les PME.</p></div>
          <div><h2 className="mb-3 text-sm font-semibold">Produit</h2><ul className="muted space-y-2 text-sm">{[...NAV, { href: "/parrainage", label: "Parrainage" }].map(n => <li key={n.href}><Link href={n.href} className="hover:text-[var(--text)]">{n.label}</Link></li>)}</ul></div>
          <div><h2 className="mb-3 text-sm font-semibold">Métiers</h2><ul className="muted space-y-2 text-sm">{SECTORS.map(s => <li key={s.slug}><Link href={`/secteurs/${s.slug}`} className="hover:text-[var(--text)]">{s.name}</Link></li>)}</ul></div>
          <div><h2 className="mb-3 text-sm font-semibold">Entreprise</h2><ul className="muted space-y-2 text-sm">
            {[["/contact", "Contact"], ["/mentions-legales", "Mentions légales"], ["/confidentialite", "Confidentialité"], ["/conditions", "Conditions générales"], ["/cookies", "Cookies"]].map(([h, l]) => <li key={h}><Link href={h} className="hover:text-[var(--text)]">{l}</Link></li>)}
          </ul></div>
        </div>
        <p className="muted pb-8 text-center text-xs">© {new Date().getFullYear()} RelancePro</p>
      </footer>
      <PageView />
    </>
  );
}
