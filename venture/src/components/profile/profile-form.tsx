"use client";
import { useActionState } from "react";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { CityInput } from "@/components/ui/city-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { saveProfileAction } from "@/lib/actions/social";
import { AVAILABILITY, EXPERIENCE, SKILL_SUGGESTIONS } from "@/lib/constants";
import type { Profile } from "@/lib/auth";

const INTEREST_SUGGESTIONS = ["Musique", "Entrepreneuriat", "Mode", "Voyage", "Sport", "Jeux vidéo", "Cinéma", "Tech", "Écologie", "Art", "Gastronomie", "Événementiel"];
const AMBITION_SUGGESTIONS = ["Créer une entreprise", "Organiser un événement", "Lancer une marque", "Rejoindre une équipe", "Réaliser un film", "Voyager autrement"];

export function ProfileForm({ profile, onboarding = false, next = "/", locationShared = false }: { profile: Profile; onboarding?: boolean; next?: string; locationShared?: boolean }) {
  const [state, action] = useActionState(saveProfileAction, null);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {onboarding && <input type="hidden" name="onboarding" value="1" />}
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="share_location_present" value="1" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom ou pseudonyme" htmlFor="display_name" error={f.display_name}>
          <Input id="display_name" name="display_name" defaultValue={profile.display_name} maxLength={60} required />
        </Field>
        <Field label="Nom d'utilisateur" htmlFor="username" error={f.username} hint="venture.app/u/…">
          <Input id="username" name="username" defaultValue={profile.username} maxLength={24} pattern="[a-z0-9_]{3,24}" required />
        </Field>
      </div>
      <Field label="Biographie" htmlFor="bio" error={f.bio}>
        <Textarea id="bio" name="bio" defaultValue={profile.bio} maxLength={600} rows={3} placeholder="Qui es-tu, qu'est-ce qui te motive ?" />
      </Field>
      <Field label="Compétences" htmlFor="skills" error={f.skills} hint="Ce que tu peux apporter à un projet. Utilisé pour le matching.">
        <TagInput id="skills" name="skills" defaultValue={profile.skills} suggestions={SKILL_SUGGESTIONS} max={25} placeholder="Design, Marketing…" />
      </Field>
      <Field label="Centres d'intérêt" htmlFor="interests" error={f.interests}>
        <TagInput id="interests" name="interests" defaultValue={profile.interests} suggestions={INTEREST_SUGGESTIONS} max={25} placeholder="Musique, Voyage…" />
      </Field>
      <Field label="Ambitions" htmlFor="ambitions" error={f.ambitions} hint="Ce que tu aimerais réaliser.">
        <TagInput id="ambitions" name="ambitions" defaultValue={profile.ambitions} suggestions={AMBITION_SUGGESTIONS} max={10} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Disponibilités" htmlFor="availability">
          <Select id="availability" name="availability" defaultValue={profile.availability}>
            {AVAILABILITY.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Expérience" htmlFor="experience">
          <Select id="experience" name="experience" defaultValue={profile.experience}>
            {EXPERIENCE.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Ville (facultatif)" htmlFor="city" error={f.city} hint="Affichée sur ton profil. Laisse vide pour ne pas l'afficher.">
        <CityInput id="city" name="city" defaultValue={profile.city} />
      </Field>
      <Checkbox name="share_location" defaultChecked={onboarding ? true : locationShared} label="Utiliser ma ville pour « À proximité » et le matching" description="Seule une position approximative (centre de la ville) est utilisée. Elle n'est jamais affichée aux autres membres." />
      <Field label="Portfolio (facultatif)" htmlFor="portfolio_url" error={f.portfolio_url}>
        <Input id="portfolio_url" name="portfolio_url" type="url" defaultValue={profile.portfolio_url ?? ""} placeholder="https://…" />
      </Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Enregistrement…">
        {onboarding ? "Terminer et découvrir les projets" : "Enregistrer"}
      </SubmitButton>
    </form>
  );
}
