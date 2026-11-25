import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ResetPasswordPage() {
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Indique ton email, nous t'envoyons un lien de réinitialisation.</p>
      <ResetPasswordForm />
    </div>
  );
}
