import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/ai/orchestrator";
import { isAIConfigured, AIUnavailableError } from "@/lib/ai/client";
import { getWebsiteSnapshot } from "@/lib/site/get-snapshot";
import { applyModificationDiff } from "@/lib/site/apply-modification";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  if (!isAIConfigured()) {
    return NextResponse.json({ error: new AIUnavailableError().message }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) return NextResponse.json({ error: "Merci de décrire la modification souhaitée." }, { status: 422 });

  const snapshot = await getWebsiteSnapshot(supabase, projectId);
  if (!snapshot) return NextResponse.json({ error: "Site introuvable." }, { status: 404 });

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "modification")
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ project_id: projectId, type: "modification" })
      .select("id")
      .single();
    conversation = created;
  }
  if (!conversation) return NextResponse.json({ error: "Impossible de créer la conversation." }, { status: 500 });

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: instruction,
  });

  try {
    const diff = await orchestrator.modification.interpret(instruction, snapshot);

    if (diff.clarification_needed) {
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: diff.clarification_needed,
        structured_payload: { clarification_needed: diff.clarification_needed },
      });
      return NextResponse.json({ clarification_needed: diff.clarification_needed });
    }

    await applyModificationDiff(supabase, snapshot.website.id, projectId, diff);

    const updatedSnapshot = await getWebsiteSnapshot(supabase, projectId);
    await supabase.from("site_versions").insert({
      website_id: snapshot.website.id,
      label: diff.summary || "Modification IA",
      snapshot: updatedSnapshot,
      created_by: user.id,
    });

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: diff.summary,
      structured_payload: diff as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ summary: diff.summary, applied: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "La modification a échoué.";
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: `Une erreur est survenue : ${message}`,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "modification")
    .maybeSingle();

  if (!conversation) return NextResponse.json({ messages: [] });

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages ?? [] });
}
