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

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isSupabaseConfigured()) return <NotConfiguredNotice />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <motion.div variants={fadeUp("balanced")} initial="hidden" animate="show" className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-medium">Vérifiez votre boîte mail</h1>
        <p className="text-sm text-muted-foreground">
          Un lien de confirmation a été envoyé à <strong>{email}</strong>. Cliquez dessus pour activer
          votre compte.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp("balanced")} initial="hidden" animate="show" className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium">Créer votre compte</h1>
        <p className="text-sm text-muted-foreground">
          Commencez à construire votre système commercial avec Seedflow.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom complet</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Camille Dupont"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.fr"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={loading}>
          Créer mon compte
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-foreground hover:text-accent">
          Se connecter
        </Link>
      </p>
    </motion.div>
  );
}
