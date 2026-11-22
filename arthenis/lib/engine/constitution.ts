import { deriveVisualIdentity, TECH_BY_ERA, type WorldVisualIdentity } from "../world/identity";
import type { Constitution, Era, World, WorldType } from "./types";

export const WORLD_TYPES: { id: WorldType; label: string; hint: string }[] = [
  { id: "realiste", label: "Réaliste", hint: "Les lois de notre monde, sans surnaturel." },
  { id: "fantastique", label: "Fantastique", hint: "Magie, créatures, divinités possibles." },
  { id: "medieval", label: "Médiéval", hint: "Royaumes, châteaux, acier et foi." },
  { id: "futuriste", label: "Futuriste", hint: "Technologies avancées sur une planète." },
  { id: "science-fiction", label: "Science-fiction", hint: "Voyage spatial, systèmes stellaires, IA." },
  { id: "post-apocalyptique", label: "Post-apocalyptique", hint: "Ruines, survie, ressources rares." },
  { id: "historique", label: "Historique", hint: "Une époque réelle, fidèlement reconstituée." },
  { id: "contemporain", label: "Contemporain", hint: "Le monde d'aujourd'hui, réinventé." },
  { id: "cosmique", label: "Cosmique", hint: "Galaxies, entités primordiales, échelles immenses." },
  { id: "invente", label: "Entièrement inventé", hint: "Aucune référence imposée. Vous fixez tout." }
];

export const ERAS: Era[] = ["préhistorique", "antique", "médiéval", "renaissance", "industriel", "moderne", "futur proche", "futur lointain"];

const PRESET: Record<WorldType, Partial<Constitution> & { era: Era }> = {
  realiste: { era: "moderne", realism: "strict", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: false, deities: false, intelligentSpecies: false } },
  fantastique: { era: "médiéval", realism: "libre", magic: { allowed: true, system: "Magie élémentaire", cost: "Fatigue et vieillissement prématuré" }, creatures: { fictional: true, deities: true, intelligentSpecies: true } },
  medieval: { era: "médiéval", realism: "plausible", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: false, deities: false, intelligentSpecies: false } },
  futuriste: { era: "futur proche", realism: "plausible", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: false, deities: false, intelligentSpecies: false } },
  "science-fiction": { era: "futur lointain", realism: "plausible", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: true, deities: false, intelligentSpecies: true }, physics: { gravity: "variable", ftl: true, notes: "Propulsion supraluminique contrôlée." } },
  "post-apocalyptique": { era: "moderne", realism: "plausible", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: false, deities: false, intelligentSpecies: false }, resources: ["eau potable", "carburant", "pièces détachées", "semences"] },
  historique: { era: "renaissance", realism: "strict", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: false, deities: false, intelligentSpecies: false } },
  contemporain: { era: "moderne", realism: "plausible", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: false, deities: false, intelligentSpecies: false } },
  cosmique: { era: "futur lointain", realism: "libre", magic: { allowed: true, system: "Forces primordiales", cost: "Entropie" }, creatures: { fictional: true, deities: true, intelligentSpecies: true }, physics: { gravity: "variable", ftl: true, notes: "Les constantes physiques varient selon les galaxies." } },
  invente: { era: "médiéval", realism: "libre", magic: { allowed: false, system: "", cost: "" }, creatures: { fictional: true, deities: false, intelligentSpecies: true } }
};

export function defaultConstitution(type: WorldType = "invente", blank = false): Constitution {
  const p = PRESET[type];
  return {
    worldType: type,
    era: p.era,
    realism: p.realism ?? "plausible",
    calendar: { startYear: 1, daysPerYear: 360, monthsPerYear: 12, eraName: "AF" },
    physics: p.physics ?? { gravity: "terrestre", ftl: false, notes: "" },
    magic: p.magic ?? { allowed: false, system: "", cost: "" },
    technology: { maxLevel: TECH_BY_ERA[p.era], allowed: [], forbidden: [] },
    creatures: p.creatures ?? { fictional: false, deities: false, intelligentSpecies: false },
    npcs: { allowed: true },
    climate: "tempéré",
    geography: "",
    resources: p.resources ?? ["bois", "pierre", "eau", "céréales", "fer"],
    civilizations: "",
    fundamentalRules: [],
    contribution: { mode: "proposals", guardianStrict: true },
    blank
  };
}

/** Fills any missing field (older rows, partial input) without overriding the creator's choices. */
export function normalizeConstitution(input: unknown): Constitution {
  const c = (input && typeof input === "object" ? input : {}) as Partial<Constitution>;
  const base = defaultConstitution((c.worldType as WorldType) ?? "invente", Boolean(c.blank));
  return {
    ...base,
    ...c,
    calendar: { ...base.calendar, ...(c.calendar ?? {}) },
    physics: { ...base.physics, ...(c.physics ?? {}) },
    magic: { ...base.magic, ...(c.magic ?? {}) },
    technology: { ...base.technology, ...(c.technology ?? {}) },
    creatures: { ...base.creatures, ...(c.creatures ?? {}) },
    npcs: { ...base.npcs, ...(c.npcs ?? {}) },
    contribution: { ...base.contribution, ...(c.contribution ?? {}) },
    resources: Array.isArray(c.resources) ? c.resources : base.resources,
    fundamentalRules: Array.isArray(c.fundamentalRules) ? c.fundamentalRules.map(r => ({ ...r, forbiddenTerms: Array.isArray(r.forbiddenTerms) ? r.forbiddenTerms : [] })) : []
  };
}

/** Human-readable list of the world's laws, used by Guardian messages, the Brain and AI prompts. */
export function lawsAsText(c: Constitution): { key: string; title: string; text: string }[] {
  const out = [
    { key: "type", title: "Nature du monde", text: `${WORLD_TYPES.find(t => t.id === c.worldType)?.label ?? c.worldType}, époque ${c.era}, réalisme ${c.realism}.` },
    { key: "magic", title: "Magie", text: c.magic.allowed ? `Autorisée${c.magic.system ? ` — ${c.magic.system}` : ""}${c.magic.cost ? `. Coût : ${c.magic.cost}` : ""}.` : "La magie n'existe pas dans ce monde." },
    { key: "technology", title: "Technologie", text: `Niveau maximal ${c.technology.maxLevel}/10.${c.technology.allowed.length ? ` Autorisées : ${c.technology.allowed.join(", ")}.` : ""}${c.technology.forbidden.length ? ` Interdites : ${c.technology.forbidden.join(", ")}.` : ""}` },
    { key: "creatures", title: "Créatures", text: c.creatures.fictional ? "Les créatures fictives sont autorisées." : "Seuls des animaux réels existent." },
    { key: "deities", title: "Divinités", text: c.creatures.deities ? "Des divinités peuvent exister." : "Aucune divinité n'a d'existence tangible." },
    { key: "npcs", title: "PNJ", text: c.npcs.allowed ? "Les personnages non joueurs sont autorisés." : "Le créateur n'autorise pas les PNJ." },
    { key: "physics", title: "Physique", text: `Gravité ${c.physics.gravity}. Voyage supraluminique ${c.physics.ftl ? "possible" : "impossible"}.${c.physics.notes ? ` ${c.physics.notes}` : ""}` },
    { key: "climate", title: "Climat & géographie", text: `Climat ${c.climate}.${c.geography ? ` ${c.geography}` : ""}` }
  ];
  for (const r of c.fundamentalRules) out.push({ key: `rule:${r.id}`, title: r.title, text: r.description });
  return out;
}

/** The world's persistent visual identity, now driven by explicit constitutional choices. */
export function identityFor(world: Pick<World, "id" | "name" | "description" | "constitution">, seedSalt?: string): WorldVisualIdentity {
  const c = world.constitution;
  const base = deriveVisualIdentity(
    {
      id: seedSalt ? `${world.id}:${seedSalt}` : world.id,
      name: world.name,
      theme: `${c.worldType} ${c.era} ${c.geography}`,
      description: world.description,
      magic_enabled: c.magic.allowed,
      fiction_enabled: c.worldType !== "realiste" && c.worldType !== "historique",
      fictional_creatures_enabled: c.creatures.fictional
    },
    c.fundamentalRules,
    { era: c.era, climate: c.climate, techLevel: c.technology.maxLevel }
  );
  return base;
}

/** Years/months/days from a tick, for display. */
export function formatTick(tick: number, c: Pick<Constitution, "calendar">): string {
  const { daysPerYear, monthsPerYear, startYear, eraName } = c.calendar;
  const year = Math.floor(tick / daysPerYear) + startYear;
  const dayOfYear = tick % daysPerYear;
  const monthLen = Math.max(1, Math.floor(daysPerYear / monthsPerYear));
  const month = Math.min(monthsPerYear, Math.floor(dayOfYear / monthLen) + 1);
  const day = (dayOfYear % monthLen) + 1;
  return `Jour ${day}, mois ${month}, an ${year} ${eraName}`.trim();
}

export function yearsOf(ticks: number, c: Pick<Constitution, "calendar">): number {
  return ticks / c.calendar.daysPerYear;
}
