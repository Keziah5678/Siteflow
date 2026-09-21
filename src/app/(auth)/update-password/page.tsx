"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fadeUp } from "@/lib/motion";
import { NotConfiguredNotice } from "@/components/auth/not-configured-notice";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseConfigured()) return <NotConfiguredNotice />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div variants={fadeUp("balanced")} initial="hidden" animate="show" className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-medium">Nouveau mot de passe</h1>
        <p className="text-sm text-muted-foreground">Choisissez un nouveau mot de passe pour votre compte.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            type="password"
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
          Mettre à jour
        </Button>
      </form>
    </motion.div>
  );
}
