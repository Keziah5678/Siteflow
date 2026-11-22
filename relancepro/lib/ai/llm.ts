import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "../server/env";
import { PROMPT_VERSION, type DraftFacts } from "./engine";

/**
 * Optional language-model layer behind a provider abstraction. It only
 * rewrites the wording of a follow-up; the facts it may use are passed
 * explicitly and its output is validated (zod) then checked by reviewDraft().
 * Prompts are versioned (PROMPT_VERSION) and stored with each message.
 */

export const llmAvailable = () => (env.aiProvider === "anthropic" && !!env.anthropicKey) || (env.aiProvider === "openai" && !!env.openaiKey);

export type LlmResult<T> = { data: T; provider: string; model: string; inputTokens: number; outputTokens: number; costMicros: number };

const DraftOut = z.object({ subject: z.string().min(3).max(200), body: z.string().min(40).max(4000) });

const SYSTEM_FOLLOWUP = `Tu rédiges des relances commerciales en français pour une PME, au nom de l'entreprise.
Règles absolues :
- N'utilise QUE les faits fournis. N'invente jamais de prix, remise, délai, date, disponibilité, garantie ou engagement.
- Ton professionnel, courtois, bref (80 à 140 mots), vouvoiement.
- Pas de pression commerciale abusive, pas de fausse urgence.
- N'ajoute aucun lien ni numéro de téléphone qui ne figure pas dans les faits.
- Ne mets pas de lien de désinscription : il est ajouté automatiquement.
Réponds uniquement en JSON : {"subject": "...", "body": "..."}.`;

// Rough public list prices per million tokens, used for the cost dashboard only.
const PRICE_PER_MTOK: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5], "gpt-4o-mini": [0.15, 0.6], "gpt-4o": [2.5, 10] };
const cost = (model: string, i: number, o: number) => { const [a, b] = PRICE_PER_MTOK[model] ?? [3, 15]; return Math.round(i * a + o * b); }; // micro-euros ≈ micro-dollars

function parseJson(text: string): unknown {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e < s) throw new Error("Réponse IA sans JSON");
  return JSON.parse(text.slice(s, e + 1));
}

let anthropic: Anthropic | null = null;

async function complete(system: string, prompt: string, maxTokens: number): Promise<{ text: string; model: string; provider: string; input: number; output: number }> {
  if (env.aiProvider === "anthropic") {
    anthropic ??= new Anthropic({ apiKey: env.anthropicKey });
    const res = await anthropic.beta.messages.create({
      model: env.anthropicModel, max_tokens: maxTokens, system, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }]
    });
    if (res.stop_reason === "refusal") throw new Error("Demande refusée par le modèle");
    const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
    return { text, model: env.anthropicModel, provider: "anthropic", input: res.usage.input_tokens, output: res.usage.output_tokens };
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(40_000),
    headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.openaiModel, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const j = await r.json();
  return { text: String(j.choices?.[0]?.message?.content ?? ""), model: env.openaiModel, provider: "openai", input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0 };
}

export async function llmFollowUp(f: DraftFacts, baseline: { subject: string; body: string }): Promise<LlmResult<{ subject: string; body: string }>> {
  const facts = {
    prospect: { prenom: f.prospectFirstName, nom: f.prospectLastName, entreprise: f.prospectCompany },
    besoin_exprime: f.need, dernier_message_du_prospect: f.lastInboundText.slice(0, 1500),
    devis: f.quote ? { reference: f.quote.reference, envoye_le: f.quote.sentAt?.toISOString().slice(0, 10) ?? null, montant_euros: f.quote.amountCents != null ? f.quote.amountCents / 100 : null } : null,
    entreprise: f.companyName, expediteur: f.senderName, lien_rendez_vous: f.bookingUrl, signature: f.signature,
    relance_numero: f.stepPosition, derniere_relance: f.isLastStep
  };
  const prompt = `Version du prompt : ${PROMPT_VERSION.followup}\nFAITS (seule source autorisée) :\n${JSON.stringify(facts, null, 2)}\n\nBrouillon de référence à améliorer sans ajouter de faits :\nObjet : ${baseline.subject}\n${baseline.body}`;
  const out = await complete(SYSTEM_FOLLOWUP, prompt, 1200);
  const data = DraftOut.parse(parseJson(out.text));
  return { data, provider: out.provider, model: out.model, inputTokens: out.input, outputTokens: out.output, costMicros: cost(out.model, out.input, out.output) };
}
