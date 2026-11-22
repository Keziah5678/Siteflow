import { NextResponse } from "next/server";
import { system } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness and database check for uptime monitoring. Exposes no configuration detail. */
export async function GET() {
  try {
    await system()`select 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
