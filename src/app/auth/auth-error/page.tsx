import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="font-display text-2xl font-medium">Lien invalide ou expiré</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ce lien de confirmation n'est plus valide. Demandez-en un nouveau pour continuer.
      </p>
      <div className="mt-2 flex gap-3">
        <LinkButton href="/signup" variant="outline">
          Créer un compte
        </LinkButton>
        <LinkButton href="/login">Se connecter</LinkButton>
      </div>
      <Link href="/reset-password" className="mt-1 text-xs text-muted-foreground hover:text-foreground">
        Ou réinitialiser votre mot de passe
      </Link>
    </div>
  );
}
