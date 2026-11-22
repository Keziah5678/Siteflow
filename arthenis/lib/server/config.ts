import "server-only";

/** Server-side configuration. Secrets live only here, read from the environment. */
export const AI = {
  textProvider: (process.env.ARTHENIS_TEXT_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "none")) as "openai" | "anthropic" | "none",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  imageSize: process.env.OPENAI_IMAGE_SIZE || "1024x1024",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_TEXT_MODEL || "claude-opus-5-5",
  dailyImageLimit: Number(process.env.ARTHENIS_DAILY_IMAGE_LIMIT ?? 20),
  dailyTextLimit: Number(process.env.ARTHENIS_DAILY_TEXT_LIMIT ?? 300),
  ratePerMinute: Number(process.env.ARTHENIS_RATE_LIMIT_PER_MINUTE ?? 30),
  /** Rough cost estimate per image (cents), recorded in ai_usage for cost tracking. */
  imageCostCents: Number(process.env.ARTHENIS_IMAGE_COST_CENTS ?? 4)
};

export const SUPABASE = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
};

export const textAvailable = () =>
  (AI.textProvider === "openai" && !!AI.openaiKey) || (AI.textProvider === "anthropic" && !!AI.anthropicKey);
export const imageAvailable = () => !!AI.openaiKey;
