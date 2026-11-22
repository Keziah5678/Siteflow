import { z } from "zod";
import { NextResponse } from "next/server";
import { AiUnavailable, generateImage } from "@/lib/server/ai";
import { AI } from "@/lib/server/config";
import { guard, jsonError, log, parseBody, recordUsage } from "@/lib/server/guard";

const Body = z.object({
  worldId: z.string().uuid(),
  entityId: z.string().uuid().nullable().optional(),
  prompt: z.string().min(20).max(6000)
});

/**
 * In-app image generation. The prompt is built client-side from the world's
 * visual bible (lib/ai/images.ts) so every image keeps the world's style.
 * Hosted mode: uploaded to the private bucket under the user's JWT (RLS on
 * storage checks membership) and recorded in `assets`. Local mode: returned
 * as base64 for the browser to keep.
 */
export async function POST(req: Request) {
  const caller = await guard(req, "image");
  if (caller instanceof NextResponse) return caller;
  const body = await parseBody(req, Body);
  if (body instanceof NextResponse) return body;
  try {
    const { b64, model } = await generateImage(body.prompt);
    await recordUsage(caller, "image", body.worldId, AI.imageCostCents);
    if (caller.supabase) {
      const path = `${body.worldId}/${crypto.randomUUID()}.png`;
      const bytes = Buffer.from(b64, "base64");
      const up = await caller.supabase.storage.from("arthenis-assets").upload(path, bytes, { contentType: "image/png", upsert: false });
      if (up.error) return jsonError("Image générée mais non enregistrée : droits insuffisants sur ce monde.", 403);
      await caller.supabase.from("assets").insert({ world_id: body.worldId, entity_id: body.entityId ?? null, storage_path: path, prompt: body.prompt.slice(0, 6000), model, cost_cents: AI.imageCostCents, created_by: caller.id });
      log("image_generated", { worldId: body.worldId, model });
      return NextResponse.json({ storagePath: path, model });
    }
    log("image_generated", { worldId: body.worldId, model, mode: "local" });
    return NextResponse.json({ dataUrl: `data:image/png;base64,${b64}`, model });
  } catch (e) {
    if (e instanceof AiUnavailable) return jsonError(e.message, 503, { available: false });
    log("image_error", { message: (e as Error).message });
    return jsonError((e as Error).message || "Génération impossible.", 502);
  }
}
