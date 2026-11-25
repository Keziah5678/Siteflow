import "server-only";
import type { z } from "zod";

export type AIUsage = { inputTokens: number; outputTokens: number; provider: string; model: string };
export type AIResult<T> = { data: T; usage: AIUsage };

export class AIError extends Error {
  constructor(
    public readonly kind: "not_configured" | "refused" | "invalid_output" | "rate_limited" | "upstream",
    message: string,
  ) {
    super(message);
  }
}

/** Provider abstraction: swap the implementation via AI_PROVIDER. */
export interface AIProvider {
  readonly name: string;
  generate<S extends z.ZodType>(args: { system: string; user: string; schema: S; maxTokens?: number }): Promise<AIResult<z.infer<S>>>;
}

export async function getProvider(): Promise<AIProvider> {
  const which = process.env.AI_PROVIDER ?? "anthropic";
  if (which === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) throw new AIError("not_configured", "VENTURE AI n'est pas configuré (ANTHROPIC_API_KEY manquante).");
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider();
  }
  throw new AIError("not_configured", `Fournisseur IA inconnu : ${which}`);
}
