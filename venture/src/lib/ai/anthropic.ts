import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AIError, type AIProvider, type AIResult } from "./provider";

const DEFAULT_MODEL = "claude-opus-5-5";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 });
  private model = process.env.AI_MODEL || DEFAULT_MODEL;
  private effort = (process.env.AI_EFFORT as "low" | "medium" | "high" | undefined) ?? "medium";

  async generate<S extends z.ZodType>({ system, user, schema, maxTokens = 16000 }: { system: string; user: string; schema: S; maxTokens?: number }): Promise<AIResult<z.infer<S>>> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { effort: this.effort, format: betaZodOutputFormat(schema) },
        // Server-side refusal fallback (routes by refusal category).
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (response.stop_reason === "refusal") {
        throw new AIError("refused", "VENTURE AI ne peut pas traiter cette demande.");
      }
      if (response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new AIError("invalid_output", "La réponse de l'IA est incomplète. Réessaie.");
      }
      return {
        data: response.parsed_output as z.infer<S>,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, provider: this.name, model: response.model },
      };
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new AIError("rate_limited", "Le service IA est saturé. Réessaie dans un instant.");
      if (e instanceof Anthropic.AuthenticationError) throw new AIError("not_configured", "Clé API IA invalide.");
      if (e instanceof Anthropic.APIError) {
        console.error("[venture-ai] API error", e.status, e.message);
        throw new AIError("upstream", "Le service IA est momentanément indisponible.");
      }
      console.error("[venture-ai] unexpected", e);
      throw new AIError("upstream", "Le service IA est momentanément indisponible.");
    }
  }
}
