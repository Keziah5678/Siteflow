import { z } from "zod";
import { NextResponse } from "next/server";
import { AiUnavailable, generateJson } from "@/lib/server/ai";
import { guard, jsonError, log, parseBody, recordUsage } from "@/lib/server/guard";

const Body = z.object({
  worldId: z.string().max(64).nullable().optional(),
  laws: z.array(z.object({ key: z.string().max(80), title: z.string().max(200), text: z.string().max(2000) })).max(60),
  facts: z.array(z.string().max(600)).max(30),
  draft: z.object({ kind: z.string().max(40), name: z.string().max(160), summary: z.string().max(4000), data: z.record(z.string(), z.unknown()).optional() }),
  rulesVerdict: z.enum(["VALID", "WARNING", "CONFLICT"])
});

type AiReview = { issues?: Array<{ severity: "WARNING" | "CONFLICT"; code: string; message: string; suggestion?: string }>; consequences?: string[]; alternatives?: string[] };

/** Second opinion on top of the deterministic Guardian. Advisory only: the client merges it with mergeAiReview(). */
export async function POST(req: Request) {
  const caller = await guard(req, "text");
  if (caller instanceof NextResponse) return caller;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const review = await generateJson<AiReview>({
      system: "Tu es GUARDIAN, le moteur de cohérence d'un monde fictif sur la plateforme Arthenis. Tu vérifies qu'une création respecte les LOIS du monde et les FAITS établis. Tu n'inventes jamais de loi. Tu ne modifies jamais les lois. Tu réponds en français.",
      prompt: `LOIS (clé — titre : texte)\n${body.laws.map(l => `${l.key} — ${l.title} : ${l.text}`).join("\n")}\n\nFAITS ÉTABLIS\n${body.facts.map(f => `- ${f}`).join("\n") || "- aucun"}\n\nCRÉATION PROPOSÉE (${body.draft.kind}) « ${body.draft.name} »\n${body.draft.summary}\n${body.draft.data ? JSON.stringify(body.draft.data).slice(0, 1500) : ""}\n\nLe moteur de règles déterministe a déjà rendu : ${body.rulesVerdict}.\nSignale uniquement ce qu'il a pu manquer : contradictions subtiles avec un fait ou une loi, conséquences narratives plausibles, alternatives compatibles.\nFormat JSON : {"issues":[{"severity":"WARNING"|"CONFLICT","code":"<clé de la loi citée>","message":"...","suggestion":"..."}],"consequences":["..."],"alternatives":["..."]}. Un CONFLICT doit citer la clé exacte d'une loi. Listes vides si rien à signaler.`,
      maxTokens: 700
    });
    await recordUsage(caller, "text", body.worldId ?? null);
    return NextResponse.json({ available: true, review });
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ available: false });
    log("ai_guardian_error", { message: (e as Error).message });
    return jsonError("Le second avis IA est indisponible ; le verdict des règles s'applique.", 502, { available: false });
  }
}
