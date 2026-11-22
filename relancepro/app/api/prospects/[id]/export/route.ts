import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/session";
import { exportProspect } from "@/lib/app/prospects";
import { AppError } from "@/lib/app/context";

export const dynamic = "force-dynamic";

/** RGPD right of access: the full file of one prospect, as JSON. */
export async function GET(_req: Request, ctx: RouteContext<"/api/prospects/[id]/export">) {
  const { id } = await ctx.params;
  const { ctx: org } = await requireContext();
  try {
    const data = await exportProspect(org, id);
    return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="prospect-${id}.json"` } });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
