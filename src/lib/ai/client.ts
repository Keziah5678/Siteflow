import OpenAI from "openai";
import type { z } from "zod";

export class AIUnavailableError extends Error {
  constructor() {
    super(
      "L'IA n'est pas configurée. Renseignez OPENAI_API_KEY dans les variables d'environnement pour activer cette fonctionnalité.",
    );
    this.name = "AIUnavailableError";
  }
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AIUnavailableError();
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

/**
 * Calls the model and validates its JSON response against `schema`. Retries
 * once, feeding the validation error back to the model, before giving up —
 * we never fall back to fabricated data on failure, we surface the error.
 */
export async function generateStructured<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const openai = getClient();
  const model = getModel();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: options.system },
    { role: "user", content: options.user },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.6,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: "Ta réponse n'était pas un JSON valide. Renvoie uniquement un objet JSON valide.",
      });
      continue;
    }

    const result = options.schema.safeParse(parsedJson);
    if (result.success) return result.data;

    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `Le JSON ne respecte pas le schéma attendu : ${result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}. Corrige et renvoie un JSON valide complet.`,
    });
  }

  throw new Error("L'IA n'a pas pu produire une réponse structurée valide après plusieurs tentatives.");
}
