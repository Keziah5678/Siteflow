import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight">Rejoins VENTURE</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Publie ce que tu veux réaliser. Trouve les personnes pour le faire.</p>
      <SignupForm />
    </div>
  );
}
