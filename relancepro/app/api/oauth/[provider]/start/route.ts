import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireContext } from "@/lib/auth/session";
import { oauthConfigured, oauthUrl } from "@/lib/mail/mailbox";
import { randomToken } from "@/lib/server/crypto";
import { env } from "@/lib/server/env";

export async function GET(_req: Request, ctx: RouteContext<"/api/oauth/[provider]/start">) {
  const { provider } = await ctx.params;
  const { ctx: org } = await requireContext();
  if ((provider !== "gmail" && provider !== "outlook") || !oauthConfigured(provider)) return NextResponse.redirect(`${env.appUrl}/app/settings?error=${encodeURIComponent("Connexion OAuth non configurée.")}#boite`);
  if (org.role === "member") return NextResponse.redirect(`${env.appUrl}/app/settings?error=${encodeURIComponent("Réservé aux administrateurs.")}`);
  const state = randomToken(24);
  (await cookies()).set("rp_oauth", `${state}.${org.orgId}`, { httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/api/oauth", maxAge: 600 });
  return NextResponse.redirect(oauthUrl(provider, state));
}
