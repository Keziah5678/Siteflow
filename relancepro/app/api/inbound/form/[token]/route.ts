import { NextResponse } from "next/server";
import { receiveForm } from "@/lib/app/inbound";
import { AppError } from "@/lib/app/context";
import { logError } from "@/lib/server/ops";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/** Public endpoint for the company's website form. Accepts JSON or a classic HTML form post. */
export async function POST(req: Request, ctx: RouteContext<"/api/inbound/form/[token]">) {
  const { token } = await ctx.params;
  const type = req.headers.get("content-type") ?? "";
  const isForm = type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");
  let body: Record<string, unknown> = {};
  try { body = isForm ? Object.fromEntries((await req.formData()).entries()) as Record<string, unknown> : await req.json(); }
  catch { return NextResponse.json({ error: "Requête invalide" }, { status: 400 }); }
  const redirectTo = typeof body.redirect === "string" && /^https:\/\/[^\s]+$/.test(body.redirect) ? body.redirect : null;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  try {
    await receiveForm(token, body, { ip, page: req.headers.get("referer") ?? undefined });
  } catch (e) {
    if (e instanceof AppError) {
      const status = e.code === "not_found" ? 404 : e.code === "limit" ? 429 : 400;
      return isForm ? new NextResponse(`<p>${e.message}</p>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } }) : NextResponse.json({ error: e.message }, { status });
    }
    await logError("inbound_form", e);
    return NextResponse.json({ error: "Erreur temporaire" }, { status: 500 });
  }
  if (isForm) return redirectTo ? NextResponse.redirect(redirectTo, 303) : new NextResponse("<!doctype html><meta charset=utf-8><title>Merci</title><p style='font-family:sans-serif'>Merci, votre demande a bien été envoyée.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
  return NextResponse.json({ ok: true });
}
