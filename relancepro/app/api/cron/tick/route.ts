import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { tick } from "@/lib/jobs/handlers";
import { env } from "@/lib/server/env";
import { logError } from "@/lib/server/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Worker tick, called by Vercel Cron (Authorization: Bearer CRON_SECRET). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  if (!env.cronSecret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const r = await tick(50);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    await logError("cron", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
