import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { describeUpstreamFailure } from "../ai/errors";
import { IMAGE_MODEL_CANDIDATES, imageRequestBody, isModelAccessFailure } from "../ai/models";
import { AI, textAvailable } from "./config";

/**
 * AI abstraction layer. Routes never call a vendor directly: they ask for
 * text or an image, and this module picks the configured provider. Swapping
 * provider is an environment change, not a code change.
 */

export class AiUnavailable extends Error {}

let anthropic: Anthropic | null = null;

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new Error("no_json");
  return JSON.parse(cleaned.slice(start, Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]")) + 1));
}

async function openaiText(system: string, prompt: string, maxTokens: number, json: boolean): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${AI.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI.openaiTextModel,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      ...(json ? { response_format: { type: "json_object" } } : {})
    }),
    signal: AbortSignal.timeout(45_000)
  });
  if (!res.ok) throw new Error(describeUpstreamFailure(res.status, await res.text()));
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "");
}

async function anthropicText(system: string, prompt: string, maxTokens: number): Promise<string> {
  anthropic ??= new Anthropic({ apiKey: AI.anthropicKey });
  const response = await anthropic.beta.messages.create({
    model: AI.anthropicModel,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: prompt }]
  });
  if (response.stop_reason === "refusal") throw new Error("La demande a été refusée par le modèle.");
  return response.content.map(b => (b.type === "text" ? b.text : "")).join("");
}

/** Plain or JSON text generation. Throws AiUnavailable when no provider is configured. */
export async function generateText(opts: { system: string; prompt: string; maxTokens?: number; json?: boolean }): Promise<string> {
  if (!textAvailable()) throw new AiUnavailable("Aucun fournisseur IA texte configuré.");
  const max = opts.maxTokens ?? 1200;
  const system = opts.json ? `${opts.system}\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour.` : opts.system;
  return AI.textProvider === "anthropic" ? anthropicText(system, opts.prompt, Math.max(max, 2000)) : openaiText(system, opts.prompt, max, Boolean(opts.json));
}

export async function generateJson<T>(opts: { system: string; prompt: string; maxTokens?: number }): Promise<T> {
  const text = await generateText({ ...opts, json: true });
  return extractJson(text) as T;
}

/** Image generation with model fallback (kept from the beta engine). Returns base64 PNG. */
export async function generateImage(prompt: string): Promise<{ b64: string; model: string }> {
  if (!AI.openaiKey) throw new AiUnavailable("Génération d'images non configurée (OPENAI_API_KEY).");
  let lastError = "";
  for (const model of IMAGE_MODEL_CANDIDATES) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${AI.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(imageRequestBody(model, prompt.slice(0, 3800), AI.imageSize)),
      signal: AbortSignal.timeout(120_000)
    });
    const body = await res.text();
    if (res.ok) {
      const b64 = JSON.parse(body)?.data?.[0]?.b64_json;
      if (typeof b64 === "string" && b64) return { b64, model };
      lastError = "Réponse d'image vide.";
      continue;
    }
    lastError = describeUpstreamFailure(res.status, body);
    if (!isModelAccessFailure(res.status, body)) break; // bad key or quota: no point trying another model
  }
  throw new Error(lastError || "Génération d'image impossible.");
}
