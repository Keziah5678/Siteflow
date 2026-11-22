import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_DAYS, sessionUser, type SessionUser } from "./service";
import { loadContext, type OrgContext } from "../app/context";
import { env } from "../server/env";

export const SESSION_COOKIE = "rp_session";
export const ORG_COOKIE = "rp_org";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(ORG_COOKIE);
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export const currentUser = cache(async (): Promise<SessionUser | null> => sessionUser(await sessionToken()));

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/** Signed-in, verified user with an organization. Used by every /app page and action. */
export const requireContext = cache(async (): Promise<{ user: SessionUser; ctx: OrgContext }> => {
  const user = await requireUser();
  if (!user.emailVerified) redirect("/verify-email?pending=1");
  const orgId = (await cookies()).get(ORG_COOKIE)?.value ?? null;
  const ctx = (await loadContext(user.id, orgId)) ?? (await loadContext(user.id, null));
  if (!ctx) redirect("/signup?step=company");
  return { user, ctx };
});

export async function clientMeta() {
  const h = await headers();
  return { ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local", userAgent: h.get("user-agent") ?? "" };
}
