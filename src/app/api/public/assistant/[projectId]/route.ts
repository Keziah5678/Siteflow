import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/ai/orchestrator";
import { isAIConfigured } from "@/lib/ai/client";
import type { BusinessProfile, SectionType } from "@/lib/types";

const FALLBACK = "Je n'ai pas cette information. Vous pouvez contacter l'entreprise directement.";

// Public, unauthenticated endpoint for the on-site assistant widget. Reads
// only published content (public RLS policies) — no workspace/session
// context required or trusted here.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  if (!isAIConfigured()) {
    return NextResponse.json({ answer: FALLBACK });
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Question manquante." }, { status: 422 });

  const history = Array.isArray(body?.history)
    ? (body.history as Array<{ role: string; content: string }>)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 500) }))
    : [];

  const supabase = await createClient();

  const { data: website } = await supabase
    .from("websites")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "published")
    .maybeSingle();
  if (!website) return NextResponse.json({ answer: FALLBACK });

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle<BusinessProfile>();
  if (!profile) return NextResponse.json({ answer: FALLBACK });

  const { data: pages } = await supabase
    .from("pages")
    .select("title, slug, sections(type, content)")
    .eq("website_id", website.id)
    .eq("status", "published");

  const pagesForAssistant = (pages ?? []) as Array<{
    title: string;
    slug: string;
    sections: Array<{ type: SectionType; content: Record<string, unknown> }>;
  }>;

  const result = await orchestrator.assistant.answer(profile, pagesForAssistant, question, history);

  return NextResponse.json({ answer: result.answer });
}
