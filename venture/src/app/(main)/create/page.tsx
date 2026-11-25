import type { Metadata } from "next";
import { requireOnboarded } from "@/lib/auth";
import { isAIConfigured } from "@/lib/env";
import { getQuota } from "@/lib/ai/service";
import { Page } from "@/components/layout/page";
import { CreateFlow } from "@/components/project/create-flow";

export const metadata: Metadata = { title: "Créer un projet" };

export default async function CreatePage(props: PageProps<"/create">) {
  const sp = await props.searchParams;
  const idea = typeof sp.idea === "string" ? sp.idea.slice(0, 2000) : "";
  const { user, supabase } = await requireOnboarded(`/create${idea ? `?idea=${encodeURIComponent(idea)}` : ""}`);
  const ai = isAIConfigured();
  const quota = ai ? await getQuota(supabase) : null;
  return (
    <Page>
      <CreateFlow userId={user.id} initialIdea={idea} aiAvailable={ai} aiRemaining={quota?.remaining ?? null} />
    </Page>
  );
}
