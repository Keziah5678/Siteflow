import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireContext } from "@/lib/auth/session";
import { oauthExchange, saveOAuthMailbox } from "@/lib/mail/mailbox";
import { env } from "@/lib/server/env";
import { logError } from "@/lib/server/ops";

export async function GET(req: Request, ctx: RouteContext<"/api/oauth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const { ctx: org } = await requireContext();
  const url = new URL(req.url);
  const jar = await cookies();
  const [state, orgId] = (jar.get("rp_oauth")?.value ?? "").split(".");
  jar.delete("rp_oauth");
  const back = (k: "ok" | "error", m: string) => NextResponse.redirect(`${env.appUrl}/app/settings?${k}=${encodeURIComponent(m)}#boite`);
  if ((provider !== "gmail" && provider !== "outlook") || !state || state !== url.searchParams.get("state") || orgId !== org.orgId) return back("error", "Session OAuth invalide, recommencez.");
  const code = url.searchParams.get("code");
  if (!code) return back("error", "Autorisation refusée.");
  try {
    const t = await oauthExchange(provider, code);
    await saveOAuthMailbox(org.orgId, provider, t.refreshToken, t.email, org.org.name);
    return back("ok", `Boîte ${t.email} connectée.`);
  } catch (e) {
    await logError("oauth", e, { provider }, org.orgId);
    return back("error", (e as Error).message);
  }
}
