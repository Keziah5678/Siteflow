import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function UpdatePasswordPage() {
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Choisis un mot de passe solide.</p>
      <UpdatePasswordForm />
    </div>
  );
}
