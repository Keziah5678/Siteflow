import { NextResponse } from "next/server";
import { z } from "zod";
import { system } from "@/lib/db";
import { rateLimit } from "@/lib/server/ops";

const Body = z.object({ name: z.string().max(40).regex(/^[a-z_]+$/), path: z.string().max(200), ref: z.string().max(20).optional() });

/** First-party, cookieless audience measurement. Stores no IP and no identifier. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (!(await rateLimit(`track:${ip}`, 120, 3600)).ok) return new NextResponse(null, { status: 204 });
  await system()`insert into rp.analytics_events (name, path, ref) values (${parsed.data.name}, ${parsed.data.path.split("?")[0]}, ${parsed.data.ref ?? null})`;
  return new NextResponse(null, { status: 204 });
}
