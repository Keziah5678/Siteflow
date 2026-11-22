import { z } from "zod";
import { NextResponse } from "next/server";
import { AiUnavailable, generateJson } from "@/lib/server/ai";
import { guard, jsonError, log, parseBody, recordUsage } from "@/lib/server/guard";

const Body = z.object({
  worldId: z.string().max(64).nullable().optional(),
  world: z.string().max(4000),
  events: z.array(z.object({ title: z.string().max(240), description: z.string().max(1200) })).min(1).max(40)
});

/** Rewrites the prose of simulated events. Facts (who, what, when) stay exactly as the Time Engine decided. */
export async function POST(req: Request) {
  const caller = await guard(req, "text");
  if (caller instanceof NextResponse) return caller;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const out = await generateJson<{ events: Array<{ title: string; description: string }> }>({
      system: "Tu es le chroniqueur d'un monde sur Arthenis. Tu réécris des événements en prose de chronique, sans changer aucun fait : mêmes noms, mêmes nombres, même issue. Tu respectes l'époque et les lois du monde. Français.",
      prompt: `MONDE\n${body.world}\n\nÉVÉNEMENTS (dans l'ordre)\n${body.events.map((e, i) => `${i + 1}. ${e.title} — ${e.description}`).join("\n")}\n\nRetourne {"events":[{"title":"...","description":"..."}]} avec exactement ${body.events.length} éléments, dans le même ordre. Titres ≤ 90 caractères, descriptions ≤ 320 caractères.`,
      maxTokens: 2200
    });
    if (!Array.isArray(out.events) || out.events.length !== body.events.length) throw new Error("shape");
    await recordUsage(caller, "text", body.worldId ?? null);
    return NextResponse.json({ available: true, events: out.events.map(e => ({ title: String(e.title).slice(0, 240), description: String(e.description).slice(0, 1200) })) });
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ available: false });
    log("ai_narrate_error", { message: (e as Error).message });
    return jsonError("Narration IA indisponible ; la chronique factuelle est conservée.", 502, { available: false });
  }
}
