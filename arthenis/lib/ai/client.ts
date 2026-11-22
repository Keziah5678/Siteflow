"use client";
import { getRepository } from "../data";

/** Calls an AI route with the user's session. Returns null when AI is not available (never throws for that). */
export async function callAi<T>(path: "guardian" | "brain" | "narrate" | "suggest" | "image", body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; unavailable: boolean }> {
  try {
    const session = await getRepository().getSession();
    const res = await fetch(`/api/ai/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}) },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(json.error ?? `Erreur ${res.status}`), unavailable: json.available === false };
    if (json.available === false) return { ok: false, error: "IA non configurée sur ce serveur.", unavailable: true };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Réseau indisponible.", unavailable: true };
  }
}
