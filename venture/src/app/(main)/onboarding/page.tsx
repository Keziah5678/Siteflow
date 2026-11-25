import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/utils";
import { Page } from "@/components/layout/page";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const sp = await props.searchParams;
  const next = safeRedirectPath(typeof sp.next === "string" ? sp.next : null);
  const { profile } = await requireViewer("/onboarding");
  return (
    <Page>
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary-2">Bienvenue sur VENTURE</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Parle-nous de toi</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Tes compétences et tes envies permettent à VENTURE de te connecter aux bons projets et aux bonnes personnes. Tout est modifiable plus tard.</p>
      <ProfileForm profile={profile} onboarding next={next} />
    </Page>
  );
}
