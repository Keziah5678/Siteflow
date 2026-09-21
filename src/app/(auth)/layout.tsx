import Link from "next/link";
import { Sprout } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 lg:p-12">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-medium">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
            <Sprout className="h-4 w-4" />
          </span>
          Seedflow
        </Link>
        <div className="mx-auto w-full max-w-sm py-16">{children}</div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Seedflow. Tous droits réservés.
        </p>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--accent) 0, transparent 40%), radial-gradient(circle at 80% 70%, var(--accent) 0, transparent 35%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md space-y-4">
            <p className="font-display text-3xl leading-snug text-primary-foreground">
              « D'une idée à un véritable système commercial, en un seul flux. »
            </p>
            <p className="text-sm text-primary-foreground/70">
              Positionnement, offre, identité, site, prospects — pilotés par votre IA opérateur.
            </p>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
