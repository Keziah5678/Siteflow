"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fadeUp } from "@/lib/motion";
import { NotConfiguredNotice } from "@/components/auth/not-configured-notice";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!isSupabaseConfigured()) return <NotConfiguredNotice />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <motion.div variants={fadeUp("balanced")} initial="hidden" animate="show" className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-medium">Email envoyé</h1>
        <p className="text-sm text-muted-foreground">
          Si un compte existe pour <strong>{email}</strong>, un lien de réinitialisation vient d'être
          envoyé.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp("balanced")} initial="hidden" animate="show" className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium">Mot de passe oublié</h1>
        <p className="text-sm text-muted-foreground">
          Indiquez votre email, nous vous enverrons un lien de réinitialisation.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.fr"
          />
        </div>
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={loading}>
          Envoyer le lien
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:text-accent">
          Retour à la connexion
        </Link>
      </p>
    </motion.div>
  );
}
