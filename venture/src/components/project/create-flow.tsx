"use client";
import { useState } from "react";
import { ArrowLeft, Loader2, PenLine, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { structureIdeaHeuristically } from "@/lib/heuristics";
import type { IdeaStructure } from "@/lib/ai/schemas";
import { emptyDraft, ProjectEditor, type ProjectDraft } from "./project-editor";

function toDraft(s: IdeaStructure): ProjectDraft {
  return {
    ...emptyDraft,
    title: s.title.slice(0, 120),
    description: s.description.slice(0, 5000),
    category: s.category,
    goal: s.goal?.slice(0, 200) ?? "",
    interest_goal: s.interest_goal,
    skills_needed: s.skills_needed.slice(0, 15),
    resources_needed: s.resources_needed.slice(0, 15),
    first_steps: s.first_steps.slice(0, 12),
    budget_estimate_eur: s.budget_estimate_eur,
  };
}

export function CreateFlow({ userId, initialIdea, aiAvailable, aiRemaining }: { userId: string; initialIdea: string; aiAvailable: boolean; aiRemaining: number | null }) {
  const [idea, setIdea] = useState(initialIdea);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [source, setSource] = useState<"ai" | "auto" | "manual" | null>(null);
  const [budgetNote, setBudgetNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ideaOk = idea.trim().length >= 10;

  async function withAI() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature: "structure_idea", idea }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur IA");
      const s = json.data as IdeaStructure;
      setDraft(toDraft(s));
      setBudgetNote(s.budget_note);
      setSource("ai");
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Erreur IA"} Tu peux utiliser les suggestions automatiques ou remplir toi-même.`);
    } finally {
      setLoading(false);
    }
  }

  if (draft && source) {
    return (
      <div className="animate-rise">
        <button type="button" onClick={() => { setDraft(null); setSource(null); }} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Revenir à mon idée
        </button>
        <Notice tone={source === "ai" ? "primary" : "neutral"} className="mb-6" title={source === "ai" ? "Proposition de VENTURE AI" : source === "auto" ? "Suggestions automatiques" : "Création manuelle"}>
          {source === "manual" ? "Remplis les champs essentiels : titre, catégorie et description suffisent pour publier." : "Tout est modifiable. Vérifie et ajuste chaque élément avant de publier."}
          {source === "auto" && " Ces suggestions sont générées par des règles simples, sans intelligence artificielle."}
        </Notice>
        <ProjectEditor initial={draft} userId={userId} budgetNote={budgetNote} />
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <label htmlFor="idea" className="block text-[22px] font-semibold tracking-tight sm:text-[26px]">
        Qu'aimerais-tu réaliser ?
      </label>
      <p className="mt-1.5 text-sm text-muted">Écris librement, comme tu le dirais à un ami.</p>
      <textarea
        id="idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={4}
        maxLength={2000}
        autoFocus
        placeholder="J'aimerais créer une marque de vêtements avec d'autres personnes."
        className="mt-5 w-full resize-none rounded-2xl border border-border bg-card px-4 py-4 text-[16px] leading-relaxed placeholder:text-subtle focus:border-primary-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      {error && <Notice tone="warning" className="mt-3">{error}</Notice>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {aiAvailable && (
          <Button size="lg" onClick={withAI} disabled={!ideaOk || loading || (aiRemaining != null && aiRemaining < 1)}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Structurer avec l'IA
          </Button>
        )}
        <Button
          size="lg"
          variant={aiAvailable ? "secondary" : "primary"}
          disabled={!ideaOk || loading}
          onClick={() => {
            setDraft(toDraft(structureIdeaHeuristically(idea)));
            setSource("auto");
          }}
        >
          <Wand2 /> Suggestions automatiques
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={() => {
            setDraft({ ...emptyDraft, description: idea.trim() });
            setSource("manual");
          }}
        >
          <PenLine /> Remplir moi-même
        </Button>
      </div>
      <p className="mt-3 text-[12px] text-subtle">
        {aiAvailable
          ? aiRemaining != null
            ? `VENTURE AI : ${aiRemaining} crédit${aiRemaining > 1 ? "s" : ""} restant${aiRemaining > 1 ? "s" : ""} ce mois-ci. Rien n'est publié sans ta validation.`
            : "Rien n'est publié sans ta validation."
          : "VENTURE AI n'est pas encore activé sur cette instance : les suggestions automatiques utilisent des règles simples."}
        {!ideaOk && " Décris ton idée en au moins 10 caractères."}
      </p>
    </div>
  );
}
