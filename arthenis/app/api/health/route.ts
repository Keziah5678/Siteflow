import { NextResponse } from "next/server";
import { AI, SUPABASE, imageAvailable, textAvailable } from "@/lib/server/config";

/** Configuration status, without ever exposing a secret. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    storage: SUPABASE.url && SUPABASE.key ? "supabase" : "local",
    ai: {
      text: textAvailable() ? AI.textProvider : "none",
      textModel: textAvailable() ? (AI.textProvider === "anthropic" ? AI.anthropicModel : AI.openaiTextModel) : null,
      images: imageAvailable(),
      limits: { imagesPerDay: AI.dailyImageLimit, textPerDay: AI.dailyTextLimit, perMinute: AI.ratePerMinute }
    }
  });
}
