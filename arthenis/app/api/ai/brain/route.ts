import { z } from "zod";
import { NextResponse } from "next/server";
import { AiUnavailable, generateText } from "@/lib/server/ai";
import { guard, jsonError, log, parseBody, recordUsage } from "@/lib/server/guard";

const Body = z.object({
  worldId: z.string().max(64).nullable().optional(),
  context: z.string().max(24000),
  question: z.string().min(1).max(1200),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) })).max(8).optional()
});

/** World Brain answers, grounded in the facts retrieved client-side from the structured canon. */
export async function POST(req: Request) {
  const caller = await guard(req, "text");
  if (caller instanceof NextResponse) return caller;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const history = (body.history ?? []).map(m => `${m.role === "user" ? "Créateur" : "World Brain"} : ${m.text}`).join("\n");
    const answer = await generateText({
      system: "Tu es le WORLD BRAIN d'un monde sur Arthenis : sa mémoire. Tu réponds uniquement à partir du CONTEXTE fourni (lois et faits établis). Si une information n'est pas établie, dis-le clairement et propose de l'écrire, sans l'inventer comme un fait. Cite entre crochets les identifiants de faits utilisés, ex. [entity:…]. Réponds en français, de façon concise et évocatrice.",
      prompt: `${body.context}\n\n${history ? `ÉCHANGE RÉCENT\n${history}\n\n` : ""}QUESTION : ${body.question}`,
      maxTokens: 700
    });
    await recordUsage(caller, "text", body.worldId ?? null);
    return NextResponse.json({ available: true, answer: answer.trim().slice(0, 4000) });
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ available: false });
    log("ai_brain_error", { message: (e as Error).message });
    return jsonError("World Brain IA indisponible.", 502, { available: false });
  }
}
