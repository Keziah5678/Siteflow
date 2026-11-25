import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/forms";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeRedirectPath(typeof sp.next === "string" ? sp.next : null);
  return (
    <div className="animate-rise">
      <h1 className="text-2xl font-semibold tracking-tight">Bon retour</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Retrouve tes projets et ton équipe.</p>
      <LoginForm next={next} linkError={sp.error === "link"} />
    </div>
  );
}
