"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { CityInput } from "@/components/ui/city-input";
import { Notice } from "@/components/ui/primitives";
import { CATEGORIES, SKILL_SUGGESTIONS, STATUSES, type ProjectCategory, type ProjectStatus } from "@/lib/constants";
import { createProjectAction, updateProjectAction } from "@/lib/actions/projects";
import { uploadPublicImage } from "@/lib/upload";

export type ProjectDraft = {
  title: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  goal: string;
  interest_goal: number | null;
  skills_needed: string[];
  resources_needed: string[];
  first_steps: string[];
  budget_estimate_eur: number | null;
  city: string;
  is_remote: boolean;
  cover_url: string | null;
  venue_idea: string;
  capacity: number | null;
  price_min_eur: number | null;
  price_max_eur: number | null;
  date_options: string[];
};

export const emptyDraft: ProjectDraft = {
  title: "",
  description: "",
  category: "business",
  status: "recruiting",
  goal: "",
  interest_goal: null,
  skills_needed: [],
  resources_needed: [],
  first_steps: [],
  budget_estimate_eur: null,
  city: "",
  is_remote: false,
  cover_url: null,
  venue_idea: "",
  capacity: null,
  price_min_eur: null,
  price_max_eur: null,
  date_options: [],
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function ProjectEditor({ initial, userId, projectId, budgetNote }: { initial: ProjectDraft; userId: string; projectId?: string; budgetNote?: string | null }) {
  const router = useRouter();
  const [d, setD] = useState<ProjectDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [newStep, setNewStep] = useState("");
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const isEvent = d.category === "event";

  async function onCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const res = await uploadPublicImage("covers", userId, file, 5 * 1048576);
    setUploading(false);
    if (res.error) setError(res.error);
    else set("cover_url", res.url!);
  }

  function submit() {
    setError(null);
    setErrors({});
    start(async () => {
      const payload = { ...d, first_steps: projectId ? undefined : d.first_steps };
      const res = projectId ? await updateProjectAction(projectId, payload) : await createProjectAction(payload);
      if (res?.error) {
        setError(res.error);
        setErrors(res.fields ?? {});
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const id = projectId ?? (res?.data?.id as string);
      router.push(`/projects/${id}${projectId ? "" : "?created=1"}`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      <Field label="Titre" htmlFor="title" error={errors.title}>
        <Input id="title" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required placeholder="Ex. : Créons une marque de vêtements upcyclés" />
      </Field>

      <Field label="Catégorie" htmlFor="category" error={errors.category}>
        <div id="category" role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={d.category === c.value}
              onClick={() => set("category", c.value)}
              className={`rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors ${d.category === c.value ? "border-primary bg-primary-soft text-fg" : "border-border text-muted hover:border-border-strong"}`}
            >
              <span className="block font-medium">{c.label}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Description" htmlFor="description" error={errors.description}>
        <Textarea id="description" value={d.description} onChange={(e) => set("description", e.target.value)} rows={5} maxLength={5000} required placeholder="Ce que tu veux réaliser, pourquoi, et avec qui." />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Objectif recherché" htmlFor="goal" error={errors.goal} hint="Ex. : Constituer une équipe de 4 personnes">
          <Input id="goal" value={d.goal} onChange={(e) => set("goal", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Objectif de personnes intéressées (facultatif)" htmlFor="interest_goal" error={errors.interest_goal}>
          <Input id="interest_goal" type="number" min={1} inputMode="numeric" value={d.interest_goal ?? ""} onChange={(e) => set("interest_goal", num(e.target.value))} />
        </Field>
      </div>

      <Field label="Compétences recherchées" htmlFor="skills_needed" error={errors.skills_needed}>
        <TagInput id="skills_needed" value={d.skills_needed} onChange={(v) => set("skills_needed", v)} suggestions={SKILL_SUGGESTIONS} max={15} placeholder="Ajoute puis Entrée" />
      </Field>

      {!projectId && (
        <Field label="Premières étapes" htmlFor="new-step" hint="La progression du projet dépend des étapes réellement terminées.">
          <ol className="space-y-2">
            {d.first_steps.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 px-3 py-2 text-sm">
                <span className="text-subtle">{i + 1}.</span>
                <span className="flex-1">{s}</span>
                <button type="button" onClick={() => set("first_steps", d.first_steps.filter((_, j) => j !== i))} className="rounded p-1 text-subtle hover:text-danger" aria-label={`Supprimer l'étape ${s}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex gap-2">
            <Input
              id="new-step"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newStep.trim().length >= 2) {
                    set("first_steps", [...d.first_steps, newStep.trim()].slice(0, 12));
                    setNewStep("");
                  }
                }
              }}
              placeholder="Ajouter une étape"
              maxLength={160}
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (newStep.trim().length >= 2) {
                  set("first_steps", [...d.first_steps, newStep.trim()].slice(0, 12));
                  setNewStep("");
                }
              }}
              aria-label="Ajouter l'étape"
            >
              <Plus />
            </Button>
          </div>
        </Field>
      )}

      <Field label="Ressources nécessaires (facultatif)" htmlFor="resources_needed">
        <TagInput id="resources_needed" value={d.resources_needed} onChange={(v) => set("resources_needed", v)} max={15} placeholder="Lieu, matériel, budget…" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ville (facultatif)" htmlFor="city" error={errors.city}>
          <CityInput id="city" value={d.city} onChange={(v) => set("city", v)} />
        </Field>
        <Field label="Budget estimatif en € (facultatif)" htmlFor="budget" error={errors.budget_estimate_eur} hint={budgetNote ?? "Ordre de grandeur indicatif."}>
          <Input id="budget" type="number" min={0} inputMode="decimal" value={d.budget_estimate_eur ?? ""} onChange={(e) => set("budget_estimate_eur", num(e.target.value))} />
        </Field>
      </div>
      <Checkbox checked={d.is_remote} onChange={(e) => set("is_remote", e.target.checked)} label="Ce projet peut se faire à distance" />

      {isEvent && (
        <fieldset className="space-y-5 rounded-2xl border border-border p-4 sm:p-5">
          <legend className="px-1 text-sm font-medium">Événement à la demande</legend>
          <p className="text-[13px] text-muted">La communauté manifeste son intérêt avant que l'événement ne soit organisé. Une manifestation d'intérêt n'est ni un achat ni une réservation.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Lieu envisagé" htmlFor="venue_idea">
              <Input id="venue_idea" value={d.venue_idea} onChange={(e) => set("venue_idea", e.target.value)} maxLength={200} placeholder="Ex. : un château en Bourgogne" />
            </Field>
            <Field label="Capacité envisagée" htmlFor="capacity">
              <Input id="capacity" type="number" min={1} value={d.capacity ?? ""} onChange={(e) => set("capacity", num(e.target.value))} />
            </Field>
            <Field label="Prix indicatif min. (€)" htmlFor="price_min">
              <Input id="price_min" type="number" min={0} value={d.price_min_eur ?? ""} onChange={(e) => set("price_min_eur", num(e.target.value))} />
            </Field>
            <Field label="Prix indicatif max. (€)" htmlFor="price_max">
              <Input id="price_max" type="number" min={0} value={d.price_max_eur ?? ""} onChange={(e) => set("price_max_eur", num(e.target.value))} />
            </Field>
          </div>
          <Field label="Dates envisagées" htmlFor="date_option">
            <div className="flex flex-wrap gap-2">
              {d.date_options.map((dt) => (
                <span key={dt} className="inline-flex items-center gap-1 rounded-lg bg-bg-2 px-2.5 py-1 text-[13px]">
                  {new Date(dt + "T00:00:00").toLocaleDateString("fr-FR")}
                  <button type="button" onClick={() => set("date_options", d.date_options.filter((x) => x !== dt))} aria-label="Retirer la date" className="text-subtle hover:text-fg">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {d.date_options.length < 6 && (
                <Input
                  id="date_option"
                  type="date"
                  className="h-9 w-auto"
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    if (e.target.value && !d.date_options.includes(e.target.value)) set("date_options", [...d.date_options, e.target.value].sort());
                    e.target.value = "";
                  }}
                />
              )}
            </div>
          </Field>
        </fieldset>
      )}

      <Field label="Image de couverture (facultatif)" htmlFor="cover">
        {d.cover_url ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload preview */}
            <img src={d.cover_url} alt="Couverture" className="aspect-[2.4/1] w-full object-cover" />
            <button type="button" onClick={() => set("cover_url", null)} className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white" aria-label="Retirer l'image">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label htmlFor="cover" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-6 text-sm text-muted hover:border-primary-2 hover:text-fg">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {uploading ? "Envoi…" : "Ajouter une image (PNG, JPEG, WebP — 5 Mo max.)"}
            <input id="cover" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onCover(e.target.files?.[0])} />
          </label>
        )}
      </Field>

      {projectId && (
        <Field label="Statut" htmlFor="status">
          <Select id="status" value={d.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
      )}

      <div className="sticky bottom-20 z-10 flex justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur lg:bottom-4">
        <Button type="submit" size="lg" disabled={pending || uploading} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" />}
          {projectId ? "Enregistrer les modifications" : "Publier le projet"}
        </Button>
      </div>
    </form>
  );
}
