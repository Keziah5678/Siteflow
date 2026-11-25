import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

/**
 * Sliding-window limiter backed by Postgres (works across serverless
 * instances). Fails closed only for clearly abusive volumes: if the limiter
 * itself errors we log and allow, so an outage never locks everyone out.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient().rpc("check_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) {
      console.error("[venture] rate limit error", error);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("[venture] rate limit unavailable", e);
    return true;
  }
}
