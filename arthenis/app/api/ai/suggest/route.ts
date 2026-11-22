import { z } from "zod";
import { NextResponse } from "next/server";
import { AiUnavailable, generateJson } from "@/lib/server/ai";
import { guard, jsonError, log, parseBody, recordUsage } from "@/lib/server/guard";

const Body = z.object({
  worldId: z.string().max(64).nullable().optional(),
  kind: z.string().max(40),
  kindLabel: z.string().max(60),
  laws: z.string().max(6000),
  context: z.string().max(6000),
  hint: z.string().max(600).optional()
});

/** "Inspire-moi": proposes a draft. It is only a draft: Guardian still checks it before anything is saved. */
export async function POST(req: Request) {
  const caller = await guard(req, "text");
  if (caller instanceof NextResponse) return caller;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const draft = await generateJson<{ name: string; summary: string; data?: Record<string, unknown> }>({
      system: "Tu es l'atelier créatif d'Arthenis. Tu proposes UNE création qui respecte strictement les lois du monde et s'inscrit dans ce qui existe déjà. Français.",
      prompt: `LOIS\n${body.laws}\n\nCONTEXTE\n${body.context}\n\nCrée un(e) ${body.kindLabel}.${body.hint ? ` Indication du créateur : ${body.hint}` : ""}\nFormat JSON : {"name":"...","summary":"2 à 4 phrases","data":{ champs utiles selon le type : appearance, personality, abilities[], goals[], government, economy, culture, population (nombre), age (nombre), abundance (0-1), objectives[] }}`,
      maxTokens: 700
    });
    await recordUsage(caller, "text", body.worldId ?? null);
    return NextResponse.json({ available: true, draft: { name: String(draft.name ?? "").slice(0, 160), summary: String(draft.summary ?? "").slice(0, 4000), data: draft.data && typeof draft.data === "object" ? draft.data : {} } });
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ available: false });
    log("ai_suggest_error", { message: (e as Error).message });
    return jsonError("Suggestion IA indisponible.", 502, { available: false });
  }
}
