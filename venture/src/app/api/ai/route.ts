import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runAIFeature } from "@/lib/ai/service";
import { AIError } from "@/lib/ai/provider";
import { AI_FEATURES } from "@/lib/ai/schemas";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  feature: z.enum(Object.keys(AI_FEATURES) as [keyof typeof AI_FEATURES, ...(keyof typeof AI_FEATURES)[]]),
  idea: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Connecte-toi pour utiliser VENTURE AI." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  // Burst protection on top of the monthly credit quota.
  if (!(await rateLimit(`ai:${user.id}`, 10, 60))) return NextResponse.json({ error: "Trop de requêtes. Patiente une minute." }, { status: 429 });

  try {
    const result = await runAIFeature(supabase, user.id, parsed.data.feature, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AIError) {
      const status = e.kind === "not_configured" ? 503 : e.kind === "rate_limited" ? 429 : e.kind === "refused" ? 422 : 502;
      return NextResponse.json({ error: e.message, kind: e.kind }, { status });
    }
    console.error("[venture-ai] route error", e);
    return NextResponse.json({ error: "Erreur inattendue." }, { status: 500 });
  }
}
