"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ChipSelect } from "@/components/wizard/chip-select";
import { TagListInput } from "@/components/wizard/tag-list-input";
import { pageTransition } from "@/lib/motion";
import {
  GOALS,
  INDUSTRIES,
  PRICE_TIERS,
  SERVICE_SUGGESTIONS,
  TONES,
  VISUAL_STYLES,
  industryKind,
} from "@/lib/constants";
import type { BusinessProfile } from "@/lib/types";

interface WizardData {
  company: string;
  industry: string;
  activity: string;
  location: string;
  services: string[];
  target_audience: string;
  positioning: string;
  price_tier: string;
  tone: string;
  visual_style: string;
  goals: string[];
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  instagram: string;
  facebook: string;
  brand_colors: string[];
  logo_url: string;
}

function fromProfile(profile: BusinessProfile): WizardData {
  return {
    company: profile.company ?? "",
    industry: profile.industry ?? "",
    activity: profile.activity ?? "",
    location: profile.location ?? "",
    services: profile.services ?? [],
    target_audience: profile.target_audience ?? "",
    positioning: profile.positioning ?? "",
    price_tier: profile.price_tier ?? "",
    tone: profile.tone ?? "",
    visual_style: profile.visual_style ?? "",
    goals: profile.goals ?? [],
    contact_email: profile.contact?.email ?? "",
    contact_phone: profile.contact?.phone ?? "",
    contact_address: profile.contact?.address ?? "",
    instagram: profile.social_links?.instagram ?? "",
    facebook: profile.social_links?.facebook ?? "",
    brand_colors: profile.brand_colors ?? [],
    logo_url: profile.logo_url ?? "",
  };
}

const STEP_LABELS = ["Identité", "Activité", "Positionnement", "Style", "Objectifs", "Contact & marque"];

export function ProfileWizard({
  projectId,
  overviewHref,
  initialProfile,
}: {
  projectId: string;
  overviewHref: string;
  initialProfile: BusinessProfile;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => fromProfile(initialProfile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStep, setSavedStep] = useState<number | null>(null);

  const kind = industryKind(data.industry);
  const suggestions = SERVICE_SUGGESTIONS[data.industry] ?? [];

  const goalOptions = useMemo(() => {
    if (kind === "product") {
      return GOALS.filter((g) => g.value !== "rendez-vous");
    }
    return GOALS.filter((g) => g.value !== "vente-ligne");
  }, [kind]);

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function persist(partial: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/business-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Échec de l'enregistrement.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function stepPayload(): Record<string, unknown> {
    switch (step) {
      case 0:
        return { company: data.company, industry: data.industry };
      case 1:
        return { activity: data.activity, location: data.location, services: data.services };
      case 2:
        return {
          target_audience: data.target_audience,
          positioning: data.positioning,
          price_tier: data.price_tier || undefined,
        };
      case 3:
        return { tone: data.tone, visual_style: data.visual_style };
      case 4:
        return { goals: data.goals };
      case 5:
        return {
          contact: {
            email: data.contact_email,
            phone: data.contact_phone,
            address: data.contact_address,
          },
          social_links: {
            ...(data.instagram ? { instagram: data.instagram } : {}),
            ...(data.facebook ? { facebook: data.facebook } : {}),
          },
          brand_colors: data.brand_colors,
          logo_url: data.logo_url || null,
        };
      default:
        return {};
    }
  }

  async function handleNext() {
    const ok = await persist(stepPayload());
    if (!ok) return;
    setSavedStep(step);
    if (step < STEP_LABELS.length - 1) {
      setStep((s) => s + 1);
    } else {
      router.push(overviewHref);
      router.refresh();
    }
  }

  const canGoNext = useMemo(() => {
    if (step === 0) return data.company.trim().length > 0 && data.industry.length > 0;
    if (step === 1) return data.activity.trim().length > 0;
    if (step === 2) return data.target_audience.trim().length > 0;
    if (step === 3) return data.tone.length > 0 && data.visual_style.length > 0;
    return true;
  }, [step, data]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 lg:px-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Étape {step + 1} / {STEP_LABELS.length} — {STEP_LABELS[step]}
          </span>
          {savedStep !== null && savedStep === step - 1 ? (
            <span className="flex items-center gap-1 text-success">
              <Check className="h-3 w-3" /> Enregistré
            </span>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={pageTransition("balanced")}
          initial="initial"
          animate="animate"
          exit="exit"
          className="space-y-6"
        >
          {step === 0 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-medium">Parlez-nous de votre entreprise</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ces informations servent de socle à tout ce que Seedflow va générer pour vous.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Nom de l'entreprise</Label>
                <Input id="company" value={data.company} onChange={(e) => set("company", e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Secteur d'activité</Label>
                <Select id="industry" value={data.industry} onChange={(e) => set("industry", e.target.value)}>
                  <option value="">Sélectionnez un secteur</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-medium">Votre activité</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Décrivez ce que vous faites, où, et quels services vous proposez.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activity">Décrivez votre activité</Label>
                <Textarea
                  id="activity"
                  value={data.activity}
                  onChange={(e) => set("activity", e.target.value)}
                  placeholder="Ex : Salon de coiffure spécialisé dans les colorations naturelles…"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Localisation</Label>
                <Input
                  id="location"
                  value={data.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Ville, quartier, zone d'intervention…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Services proposés</Label>
                <TagListInput
                  value={data.services}
                  onChange={(v) => set("services", v)}
                  suggestions={suggestions}
                  placeholder="Ajouter un service"
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-medium">Votre clientèle & positionnement</h1>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target_audience">À qui vous adressez-vous ?</Label>
                <Textarea
                  id="target_audience"
                  value={data.target_audience}
                  onChange={(e) => set("target_audience", e.target.value)}
                  placeholder="Ex : Particuliers exigeants, 30-55 ans, sensibles à la qualité…"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="positioning">Ce qui vous différencie</Label>
                <Input
                  id="positioning"
                  value={data.positioning}
                  onChange={(e) => set("positioning", e.target.value)}
                  placeholder="Ex : Expertise reconnue, rapidité d'intervention, prix justes…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Niveau de gamme</Label>
                <ChipSelect
                  options={PRICE_TIERS}
                  value={data.price_tier ? [data.price_tier] : []}
                  onChange={(v) => set("price_tier", v[0] ?? "")}
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-medium">Style & ton</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ces choix orientent le design system généré pour votre site.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Ton de communication</Label>
                <ChipSelect options={TONES} value={data.tone ? [data.tone] : []} onChange={(v) => set("tone", v[0] ?? "")} />
              </div>
              <div className="space-y-1.5">
                <Label>Style visuel souhaité</Label>
                <ChipSelect
                  options={VISUAL_STYLES}
                  value={data.visual_style ? [data.visual_style] : []}
                  onChange={(v) => set("visual_style", v[0] ?? "")}
                />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-medium">Vos objectifs</h1>
                <p className="mt-1 text-sm text-muted-foreground">Sélectionnez tout ce qui s'applique.</p>
              </div>
              <ChipSelect options={goalOptions} value={data.goals} onChange={(v) => set("goals", v)} multiple />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-medium">Coordonnées & marque</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tout est optionnel ici — vous pourrez compléter plus tard.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={data.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={data.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" value={data.contact_address} onChange={(e) => set("contact_address", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" value={data.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input id="facebook" value={data.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="https://facebook.com/…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logo_url">URL du logo (optionnel)</Label>
                <Input id="logo_url" value={data.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" />
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {error ? (
        <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" />
          Précédent
        </Button>
        <Button onClick={handleNext} loading={saving} disabled={!canGoNext}>
          {step === STEP_LABELS.length - 1 ? (
            <>
              Terminer
              <Sparkles className="h-4 w-4" />
            </>
          ) : (
            <>
              Suivant
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
