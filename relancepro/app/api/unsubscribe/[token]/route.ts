import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/app/inbound";

export const dynamic = "force-dynamic";

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) and the confirmation form. */
export async function POST(req: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const r = await unsubscribe(token);
  if (!r.ok) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) return NextResponse.redirect(new URL(`/u/${token}?done=1`, req.url), 303);
  return NextResponse.json({ ok: true });
}
