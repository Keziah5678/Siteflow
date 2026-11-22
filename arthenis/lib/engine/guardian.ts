/**
 * GUARDIAN — the coherence engine.
 *
 * Deterministic first: every verdict below is reproducible and explainable, and
 * cites the law or the fact it collides with. An optional AI pass (server side,
 * see app/api/ai/guardian) may add explanations or raise a VALID to WARNING,
 * but it can never silently lower a CONFLICT found here, and it never edits the
 * laws: only the creator does, through a recorded constitutional amendment.
 */
import { canNest, isPlace, KIND_LABEL } from "./hierarchy";
import { lawsAsText } from "./constitution";
import { firstMention, mentions, norm } from "./text";
import type { Constitution, Entity, EntityDraft, GuardianIssue, GuardianReport, TimelineEvent, Verdict } from "./types";

/* ------------------------------------------------------------- lexicons */

export const MAGIC_TERMS = [
  "magie", "magique", "magicien", "sorcier", "sorciere", "sorcellerie", "mage", "sortilege", "enchantement",
  "enchanteur", "enchante", "incantation", "necromancie", "necromancien", "rune magique", "boule de feu",
  "envoutement", "malediction", "ensorcele", "arcane", "teleportation", "teleporte", "pouvoirs surnaturels",
  "pouvoir surnaturel", "invocation", "invoque", "telekinesie", "resurrection", "ressuscite", "potion magique", "baguette magique"
];

export const FANTASY_TERMS = [
  "dragon", "troll", "ogre", "griffon", "golem", "phenix", "kraken", "licorne", "gobelin", "elfe", "orc",
  "vampire", "loup-garou", "loup garou", "sirene", "hydre", "chimere", "basilic", "wyverne", "demon",
  "fantome", "spectre", "zombie", "centaure", "minotaure", "fee", "farfadet", "leviathan", "behemoth", "hippogriffe", "pegase"
];

export const DEITY_TERMS = ["dieu", "deesse", "divinite", "divin", "demi-dieu", "pantheon", "titan primordial"];

/** Term → minimal technology level (0 stone age … 10 far future). */
export const TECH_TERMS: Array<[string, number, string]> = [
  ["poudre a canon", 4, "arbalète ou trébuchet"], ["canon", 4, "trébuchet ou catapulte"], ["mousquet", 4, "arbalète"],
  ["imprimerie", 4, "copistes et manuscrits"], ["machine a vapeur", 6, "moulin à eau ou à vent"], ["bateau a vapeur", 6, "voilier"], ["locomotive", 6, "chariot tiré par des bêtes"],
  ["usine", 6, "atelier d'artisans"], ["telegraphe", 6, "messager à cheval"], ["revolver", 6, "arbalète de poing"],
  ["fusil", 6, "arc long ou arbalète"], ["pistolet", 6, "arbalète de poing"], ["electricite", 7, "lampes à huile"],
  ["ampoule", 7, "lanterne"], ["voiture", 7, "charrette ou diligence"], ["camion", 7, "convoi de chariots"],
  ["avion", 7, "pigeons voyageurs ou montgolfière"], ["telephone", 7, "messager"], ["radio", 7, "signaux de fumée ou héraut"],
  ["television", 7, "crieur public"], ["ordinateur", 7, "bibliothèque et abaque"], ["internet", 7, "réseau de messagers"],
  ["smartphone", 7, "messager ou pigeon voyageur"], ["mitrailleuse", 7, "baliste à répétition"], ["fusil d assaut", 7, "arbalète"],
  ["bombe atomique", 7, "poudre incendiaire"], ["nucleaire", 7, "forge"], ["fusee", 7, "observatoire"], ["satellite artificiel", 8, "tour de guet"],
  ["robot", 8, "automate mécanique"], ["drone", 8, "faucon de chasse"], ["intelligence artificielle", 8, "conseil d'érudits"],
  ["cyborg", 8, "prothèse de bois ou de fer"], ["implant neural", 8, "prothèse"], ["implant cybernetique", 8, "prothèse"], ["laser", 8, "arbalète de précision"],
  ["hologramme", 8, "lanterne magique ou théâtre d'ombres"], ["androide", 9, "automate"], ["vaisseau spatial", 9, "navire"],
  ["station orbitale", 9, "citadelle"], ["sabre laser", 10, "épée"], ["teleporteur", 10, "relais de poste"],
  ["nanite", 10, "remède d'apothicaire"], ["antigravite", 10, "dirigeable"], ["hyperespace", 10, "route maritime"]
];

const FTL_TERMS = ["supraluminique", "hyperespace", "distorsion spatiale", "saut spatial", "plus vite que la lumiere", "warp"];

const MAGIC_ALTERNATIVE = "un érudit, un alchimiste ou un guérisseur dont le savoir reste naturel";
const CREATURE_ALTERNATIVE = "un animal réel de grande taille (ours, crocodile marin, varan) ou une légende à laquelle les habitants croient";

/* ---------------------------------------------------------------- input */

export type GuardianContext = {
  constitution: Constitution;
  entities: Entity[];
  events?: TimelineEvent[];
  tick: number;
  /** Optional terrain probe for placement checks. */
  biomeAt?: (x: number, y: number) => string;
};

function draftText(d: EntityDraft): string {
  const data = d.data ?? {};
  const fields = ["appearance", "abilities", "personality", "origin", "goals", "history", "culture", "government", "economy", "inventory", "domain", "objectives", "description"];
  const extra = fields.map(f => {
    const v = data[f];
    return Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : "";
  });
  return norm([d.name, d.summary, ...extra].join(" "));
}

const SETTLEMENT = new Set(["city", "village", "place", "country", "region", "continent"]);

/* ----------------------------------------------------------------- core */

export function checkDraft(draft: EntityDraft, ctx: GuardianContext, opts: { selfId?: string } = {}): GuardianReport {
  const c = ctx.constitution;
  const issues: GuardianIssue[] = [];
  const consequences: string[] = [];
  const alternatives: string[] = [];
  const text = draftText(draft);
  const laws = lawsAsText(c);
  const law = (key: string) => laws.find(l => l.key === key)?.text;
  const byId = new Map(ctx.entities.map(e => [e.id, e]));

  if (!draft.name?.trim()) issues.push({ severity: "CONFLICT", code: "name_required", message: "Toute création doit porter un nom." });

  // --- Magic
  if (!c.magic.allowed) {
    const hit = firstMention(text, MAGIC_TERMS);
    if (hit) {
      issues.push({ severity: "CONFLICT", code: "magic_forbidden", message: `« ${hit} » introduit de la magie, or la magie n'existe pas dans ce monde.`, reference: law("magic"), suggestion: `Remplacer par ${MAGIC_ALTERNATIVE}.` });
      alternatives.push(`Faire de « ${draft.name} » ${MAGIC_ALTERNATIVE}.`);
    }
  }

  // --- Fictional creatures
  if (!c.creatures.fictional) {
    const hit = firstMention(text, FANTASY_TERMS);
    if (hit) {
      issues.push({ severity: "CONFLICT", code: "fiction_creature_forbidden", message: `« ${hit} » est une créature fictive, interdite par les lois de ce monde.`, reference: law("creatures"), suggestion: `Remplacer par ${CREATURE_ALTERNATIVE}.` });
      alternatives.push(`Transformer « ${draft.name} » en ${CREATURE_ALTERNATIVE}.`);
    }
    if (draft.kind === "creature") {
      issues.push({ severity: "CONFLICT", code: "creature_kind_forbidden", message: "Ce monde n'admet que des animaux réels : une « créature » fantastique ne peut pas y exister.", reference: law("creatures"), suggestion: "Créer plutôt un « Animal »." });
      alternatives.push(`Créer « ${draft.name} » comme Animal.`);
    }
  }

  // --- Deities
  if (!c.creatures.deities) {
    if (draft.kind === "deity") {
      issues.push({ severity: "CONFLICT", code: "deity_forbidden", message: "Aucune divinité n'a d'existence tangible dans ce monde.", reference: law("deities"), suggestion: "Créer une Religion : la croyance existe, le dieu n'agit pas." });
      alternatives.push(`Créer la religion qui vénère « ${draft.name} ».`);
    } else if (draft.kind !== "religion" && draft.kind !== "civilization") {
      const hit = firstMention(text, DEITY_TERMS);
      if (hit && (draft.kind === "character" || draft.kind === "npc" || draft.kind === "creature")) {
        issues.push({ severity: "WARNING", code: "deity_claim", message: `« ${hit} » : un être divin ne peut pas exister ici. Il peut s'agir d'une croyance ou d'un titre.`, reference: law("deities"), suggestion: "Préciser qu'il s'agit d'un titre, d'un culte ou d'une légende." });
      }
    }
  }

  // --- Intelligent species & NPCs
  if (draft.kind === "species" && draft.data?.intelligent === true && !c.creatures.intelligentSpecies) {
    issues.push({ severity: "CONFLICT", code: "intelligent_species_forbidden", message: "Ce monde n'admet pas d'autre espèce intelligente que celle d'origine.", reference: law("creatures") });
  }
  if (draft.kind === "npc" && !c.npcs.allowed) {
    issues.push({ severity: "CONFLICT", code: "npc_forbidden", message: "Le créateur n'autorise pas les PNJ dans ce monde.", reference: law("npcs"), suggestion: "Créer un personnage principal." });
    alternatives.push(`Créer « ${draft.name} » comme Personnage.`);
  }

  // --- Technology
  if (!c.technology.allowed.some(t => mentions(text, t))) {
    for (const [term, level, alt] of TECH_TERMS) {
      if (!mentions(text, term)) continue;
      if (level <= c.technology.maxLevel) continue;
      const gap = level - c.technology.maxLevel;
      const severity = c.realism === "strict" || gap >= 2 ? "CONFLICT" : "WARNING";
      issues.push({
        severity, code: "tech_anachronism",
        message: severity === "CONFLICT"
          ? `« ${term} » exige un niveau technologique ${level}/10, ce monde plafonne à ${c.technology.maxLevel}/10.`
          : `« ${term} » est en avance d'une génération sur ce monde : il faudra expliquer son origine.`,
        reference: law("technology"), suggestion: `Équivalent d'époque : ${alt}.`
      });
      if (severity === "CONFLICT") alternatives.push(`Remplacer « ${term} » par ${alt}.`);
      break;
    }
  }
  for (const t of c.technology.forbidden) {
    if (t.trim() && mentions(text, t)) issues.push({ severity: "CONFLICT", code: "tech_forbidden", message: `« ${t} » est explicitement interdit par la constitution.`, reference: law("technology") });
  }
  if (!c.physics.ftl) {
    const hit = firstMention(text, FTL_TERMS);
    if (hit) issues.push({ severity: "CONFLICT", code: "ftl_forbidden", message: `« ${hit} » : le voyage plus rapide que la lumière est impossible dans ce monde.`, reference: law("physics") });
  }

  // --- Creator's fundamental rules
  for (const r of c.fundamentalRules) {
    const hit = r.forbiddenTerms.find(t => t.trim() && mentions(text, t));
    if (hit) issues.push({ severity: "CONFLICT", code: `rule:${r.id}`, message: `« ${hit} » contredit la loi fondamentale « ${r.title} ».`, reference: r.description });
  }

  // --- Hierarchy
  const parent = draft.parentId ? byId.get(draft.parentId) : undefined;
  if (draft.parentId && !parent) issues.push({ severity: "CONFLICT", code: "parent_missing", message: "L'élément parent n'existe pas (ou plus) dans ce monde." });
  if (parent) {
    if (!canNest(parent.kind, draft.kind)) {
      issues.push({ severity: "CONFLICT", code: "hierarchy", message: `Un(e) ${KIND_LABEL[draft.kind]} ne peut pas se trouver dans un(e) ${KIND_LABEL[parent.kind]} : l'échelle doit descendre.` });
    }
    if (parent.status === "destroyed" || parent.status === "dead" || parent.status === "dissolved") {
      issues.push({ severity: "WARNING", code: "parent_ended", message: `« ${parent.name} » n'existe plus depuis le jour ${parent.endedTick ?? "?"}. Est-ce une reconstruction, des ruines ou un retour en arrière ?`, reference: `Statut établi : ${parent.status}` });
    }
    if (isPlace(draft.kind)) consequences.push(`« ${draft.name} » s'inscrit dans ${KIND_LABEL[parent.kind].toLowerCase()} « ${parent.name} ».`);
    else consequences.push(`« ${draft.name} » est rattaché(e) à « ${parent.name} ».`);
  }

  // --- Duplicates
  const n = norm(draft.name);
  const dup = ctx.entities.find(e => e.id !== opts.selfId && e.kind === draft.kind && norm(e.name) === n && e.status !== "archived");
  if (dup) issues.push({ severity: "WARNING", code: "duplicate", message: `Un(e) ${KIND_LABEL[draft.kind]} nommé(e) « ${dup.name} » existe déjà. Deux entités distinctes ?`, reference: dup.summary });

  // --- History: references to what has ended
  for (const e of ctx.entities) {
    if (e.id === opts.selfId || e.id === draft.parentId) continue;
    if (!(e.status === "dead" || e.status === "destroyed" || e.status === "dissolved")) continue;
    if (e.name.length < 3 || !mentions(text, e.name)) continue;
    const ev = ctx.events?.find(v => v.canon && v.entityIds.includes(e.id) && (v.kind === "death" || v.kind === "catastrophe" || v.kind === "decline"));
    issues.push({
      severity: "WARNING", code: "references_ended",
      message: `« ${e.name} » est ${e.status === "dead" ? "mort(e)" : e.status === "destroyed" ? "détruit(e)" : "dissous(te)"} depuis le jour ${e.endedTick ?? "?"}. S'agit-il d'un souvenir, d'un héritage ou d'une contradiction ?`,
      reference: ev ? `${ev.title} — ${ev.description}` : undefined,
      suggestion: "Préciser le lien au passé, ou proposer une révision assumée de l'histoire."
    });
  }

  // --- Time
  if (draft.bornTick != null && draft.bornTick > ctx.tick) {
    issues.push({ severity: "WARNING", code: "future_birth", message: `La naissance est datée du jour ${draft.bornTick}, après le présent du monde (jour ${ctx.tick}).` });
  }

  // --- Lifespan
  if ((draft.kind === "character" || draft.kind === "npc") && typeof draft.data?.age === "number") {
    const age = draft.data.age as number;
    const species = typeof draft.data.speciesId === "string" ? byId.get(draft.data.speciesId) : undefined;
    const lifespan = typeof species?.data.lifespan === "number" ? (species.data.lifespan as number) : c.magic.allowed || c.creatures.fictional ? 140 : 105;
    if (age < 0) issues.push({ severity: "CONFLICT", code: "age_negative", message: "Un âge ne peut pas être négatif." });
    else if (age > lifespan * 1.2) issues.push({ severity: c.realism === "strict" ? "CONFLICT" : "WARNING", code: "age_lifespan", message: `${age} ans dépasse largement l'espérance de vie de ${species ? `l'espèce « ${species.name} »` : "son espèce"} (≈ ${lifespan} ans).`, suggestion: "Préciser la cause de cette longévité, ou réduire l'âge." });
  }

  // --- Placement on terrain
  if (ctx.biomeAt && draft.x != null && draft.y != null && SETTLEMENT.has(draft.kind) && !c.blank) {
    const b = ctx.biomeAt(draft.x, draft.y);
    if (b === "ocean") issues.push({ severity: "WARNING", code: "on_water", message: "Cet emplacement est en pleine mer. Une cité flottante, une île ou un mauvais placement ?", suggestion: "Déplacer sur la côte la plus proche." });
  }

  // --- Deterministic consequences
  if (draft.kind === "city" || draft.kind === "village") {
    const civ = typeof draft.data?.civilizationId === "string" ? byId.get(draft.data.civilizationId) : undefined;
    if (civ) consequences.push(`La population et le territoire de « ${civ.name} » s'étendent.`);
    consequences.push("Les ressources proches seront consommées au fil du temps.");
  }
  if (draft.kind === "resource") consequences.push("Les établissements voisins pourront l'exploiter ; elle s'épuisera si elle n'est pas renouvelable.");
  if (draft.kind === "civilization") consequences.push("Elle évoluera avec le temps : population, technologie, diplomatie.");
  if (draft.kind === "character" || draft.kind === "npc") consequences.push("Ce personnage vieillira quand le temps avancera.");

  return finalize(issues, consequences, alternatives);
}

export function finalize(issues: GuardianIssue[], consequences: string[] = [], alternatives: string[] = [], engine: GuardianReport["engine"] = "rules"): GuardianReport {
  const verdict: Verdict = issues.some(i => i.severity === "CONFLICT") ? "CONFLICT" : issues.length ? "WARNING" : "VALID";
  return { verdict, issues, consequences: [...new Set(consequences)], alternatives: [...new Set(alternatives)], engine, checkedAt: new Date().toISOString() };
}

/**
 * Merges an AI review onto a deterministic report. The AI can add warnings and
 * explanations; a CONFLICT is only accepted when it cites an existing law, and
 * nothing the rules found can be removed or downgraded.
 */
export function mergeAiReview(base: GuardianReport, ai: { issues?: GuardianIssue[]; consequences?: string[]; alternatives?: string[] } | null, constitution: Constitution): GuardianReport {
  if (!ai) return base;
  const lawKeys = new Set(lawsAsText(constitution).map(l => l.key));
  const extra = (ai.issues ?? []).filter(i => i && typeof i.message === "string").map(i => {
    const cited = typeof i.code === "string" && (lawKeys.has(i.code) || lawKeys.has(i.code.replace(/^law:/, "")));
    return { ...i, code: `ai:${i.code ?? "note"}`, severity: i.severity === "CONFLICT" && cited ? "CONFLICT" as const : "WARNING" as const };
  }).slice(0, 4);
  return finalize([...base.issues, ...extra], [...base.consequences, ...(ai.consequences ?? []).slice(0, 4)], [...base.alternatives, ...(ai.alternatives ?? []).slice(0, 3)], "rules+ai");
}

/* -------------------------------------------------------- law amendments */

export type LawImpact = {
  newlyConflicting: Array<{ entityId: string; name: string; kind: string; issues: GuardianIssue[] }>;
  resolved: Array<{ entityId: string; name: string }>;
  changes: string[];
};

function diffLaws(before: Constitution, after: Constitution): string[] {
  const a = new Map(lawsAsText(before).map(l => [l.key, l]));
  const b = new Map(lawsAsText(after).map(l => [l.key, l]));
  const out: string[] = [];
  for (const [k, l] of b) {
    const prev = a.get(k);
    if (!prev) out.push(`Nouvelle loi « ${l.title} » : ${l.text}`);
    else if (prev.text !== l.text) out.push(`« ${l.title} » : ${prev.text} → ${l.text}`);
  }
  for (const [k, l] of a) if (!b.has(k)) out.push(`Loi abrogée « ${l.title} ».`);
  if (before.contribution.mode !== after.contribution.mode) out.push(`Mode de contribution : ${before.contribution.mode} → ${after.contribution.mode}.`);
  return out;
}

/** Re-checks the whole canon under the proposed laws. Nothing is deleted: entities in tension are flagged. */
export function analyzeLawChange(before: Constitution, after: Constitution, ctx: Omit<GuardianContext, "constitution">): LawImpact {
  const impact: LawImpact = { newlyConflicting: [], resolved: [], changes: diffLaws(before, after) };
  const alive = ctx.entities.filter(e => e.status !== "archived");
  for (const e of alive) {
    const draft: EntityDraft = { kind: e.kind, name: e.name, summary: e.summary, data: e.data };
    const was = checkDraft(draft, { ...ctx, constitution: before, biomeAt: undefined }, { selfId: e.id });
    const now = checkDraft(draft, { ...ctx, constitution: after, biomeAt: undefined }, { selfId: e.id });
    const conflictsNow = now.issues.filter(i => i.severity === "CONFLICT");
    if (conflictsNow.length && was.verdict !== "CONFLICT") impact.newlyConflicting.push({ entityId: e.id, name: e.name, kind: e.kind, issues: conflictsNow });
    if (!conflictsNow.length && (e.tensions.length || was.verdict === "CONFLICT")) impact.resolved.push({ entityId: e.id, name: e.name });
  }
  return impact;
}
