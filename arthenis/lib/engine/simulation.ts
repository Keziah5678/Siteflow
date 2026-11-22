/**
 * TIME ENGINE — the living time of a world.
 *
 * Explicit, deterministic rules: ageing and mortality, demography, technology
 * (capped by the constitution), stability and regime change, diplomacy (wars,
 * alliances, peace), settlement growth and decline, resource consumption,
 * migrations and climate-driven catastrophes. Same world, same tick, same
 * duration → same history. A simulation is computed as a preview; applying it
 * stores exactly what was previewed (no re-roll), and only if the world has not
 * moved on in the meantime.
 *
 * AI narration (optional) only rewrites the prose of events afterwards.
 */
import { hash32, nameFor, rng, type Rng } from "./rng";
import type { Constitution, Entity, EventKind, Relation, TimelineEvent, WorldState } from "./types";

export type SimEvent = Pick<TimelineEvent, "tick" | "title" | "description" | "kind" | "entityIds" | "consequences">;

export type EntityChange = {
  id: string;
  name: string;
  before: Partial<Entity>;
  after: Partial<Entity>;
};

export type SimulationResult = {
  id: string;
  worldId: string;
  fromTick: number;
  toTick: number;
  seed: number;
  steps: number;
  events: SimEvent[];
  changes: EntityChange[];
  newEntities: Entity[];
  newRelations: Relation[];
  endedRelations: Array<{ id: string; untilTick: number }>;
  stats: { births: number; deaths: number; wars: number; alliances: number; catastrophes: number; techAdvances: number; populationBefore: number; populationAfter: number };
};

export const DURATION_PRESETS = [
  { label: "1 jour", days: 1 }, { label: "1 mois", months: 1 }, { label: "1 an", years: 1 },
  { label: "10 ans", years: 10 }, { label: "100 ans", years: 100 }
] as const;

export function durationToTicks(d: { days?: number; months?: number; years?: number }, c: Constitution): number {
  const monthLen = Math.max(1, Math.floor(c.calendar.daysPerYear / c.calendar.monthsPerYear));
  return Math.max(1, Math.round((d.days ?? 0) + (d.months ?? 0) * monthLen + (d.years ?? 0) * c.calendar.daysPerYear));
}

const MAX_EVENTS = 300;
const MAX_STEPS = 240;
const SETTLEMENT_TIERS: Array<[number, string]> = [[0, "hameau"], [200, "village"], [2000, "bourg"], [8000, "ville"], [60000, "cité"], [500000, "métropole"]];
const GOVERNMENTS = ["monarchie", "conseil des anciens", "république", "oligarchie marchande", "théocratie", "empire", "fédération de clans"];
const CATASTROPHES: Record<string, Array<[string, string]>> = {
  "volcanique": [["Éruption", "Une éruption ensevelit les terres alentour sous la cendre."], ["Séisme", "La terre tremble et fend les murailles."]],
  "aride": [["Grande sécheresse", "Les puits tarissent, les récoltes brûlent sur pied."], ["Tempête de sable", "Le sable recouvre routes et champs."]],
  "océanique": [["Raz-de-marée", "La mer submerge les quartiers bas."], ["Tempête", "Une tempête détruit les navires au port."]],
  "arctique": [["Grand hiver", "Un hiver sans fin décime troupeaux et récoltes."], ["Avalanche", "Une avalanche emporte des habitations."]],
  "tropical": [["Épidémie", "Une fièvre se répand dans les quartiers humides."], ["Ouragan", "Un ouragan rase les toits."]],
  "tempéré": [["Inondation", "Le fleuve sort de son lit."], ["Épidémie", "Une maladie se propage dans la population."], ["Mauvaise récolte", "La récolte est perdue ; le grain manque."]]
};

type Ctx = {
  c: Constitution;
  r: Rng;
  tick: number;
  dpy: number;
  events: SimEvent[];
  ents: Map<string, Entity>;
  originals: Map<string, Entity>;
  relations: Relation[];
  newRelations: Relation[];
  endedRelations: Map<string, number>;
  newEntities: Entity[];
  stats: SimulationResult["stats"];
  worldId: string;
  simId: string;
  now: string;
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

function emit(ctx: Ctx, kind: EventKind, title: string, description: string, entityIds: string[], consequences: string[] = []) {
  if (ctx.events.length >= MAX_EVENTS) return;
  ctx.events.push({ tick: ctx.tick, kind, title, description, entityIds, consequences });
}

function tierOf(pop: number): string {
  let t = SETTLEMENT_TIERS[0][1];
  for (const [min, name] of SETTLEMENT_TIERS) if (pop >= min) t = name;
  return t;
}

function distance(a: Entity, b: Entity): number {
  if (a.x == null || a.y == null || b.x == null || b.y == null) return 50;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function civOf(e: Entity, ents: Map<string, Entity>): Entity | undefined {
  const id = typeof e.data.civilizationId === "string" ? e.data.civilizationId : null;
  if (id) return ents.get(id);
  let cur = e.parentId ? ents.get(e.parentId) : undefined;
  for (let i = 0; cur && i < 12; i++) {
    if (cur.kind === "civilization") return cur;
    cur = cur.parentId ? ents.get(cur.parentId) : undefined;
  }
  return undefined;
}

function lifespanOf(e: Entity, ctx: Ctx): number {
  const sp = typeof e.data.speciesId === "string" ? ctx.ents.get(e.data.speciesId) : undefined;
  return num(sp?.data.lifespan, num(e.data.lifespan, ctx.c.magic.allowed || ctx.c.creatures.fictional ? 95 : 80));
}

function activeRel(ctx: Ctx, a: string, b: string, type: Relation["type"]): Relation | undefined {
  const all = [...ctx.relations, ...ctx.newRelations];
  return all.find(r => r.type === type && !ctx.endedRelations.has(r.id) && r.untilTick == null && ((r.sourceId === a && r.targetId === b) || (r.sourceId === b && r.targetId === a)));
}

function addRelation(ctx: Ctx, a: string, b: string, type: Relation["type"], data: Record<string, unknown> = {}) {
  const rel: Relation = { id: ctx.r.uuid(), worldId: ctx.worldId, sourceId: a, targetId: b, type, data, sinceTick: ctx.tick, untilTick: null };
  ctx.newRelations.push(rel);
  return rel;
}

function endRelation(ctx: Ctx, rel: Relation) {
  if (ctx.newRelations.includes(rel)) rel.untilTick = ctx.tick;
  else ctx.endedRelations.set(rel.id, ctx.tick);
}

/* -------------------------------------------------------------- systems */

function stepBeings(ctx: Ctx, dt: number) {
  for (const e of sorted(ctx.ents)) {
    if ((e.kind !== "character" && e.kind !== "npc" && e.kind !== "animal") || e.status !== "active") continue;
    if (e.bornTick == null) continue;
    const age = (ctx.tick - e.bornTick) / ctx.dpy;
    e.data.age = Math.floor(age);
    if (e.data.immortal === true && (ctx.c.magic.allowed || ctx.c.creatures.fictional)) continue;
    const L = e.kind === "animal" ? num(e.data.lifespan, 15) : lifespanOf(e, ctx);
    const pYear = 0.002 + 0.98 / (1 + Math.exp(-(age - L) / (L * 0.05)));
    if (ctx.r.chance(1 - Math.pow(1 - pYear, dt))) {
      e.status = "dead";
      e.endedTick = ctx.tick;
      ctx.stats.deaths++;
      emit(ctx, "death", `Mort de ${e.name}`, `${e.name} s'éteint à l'âge de ${Math.floor(age)} ans.`, [e.id], ["Ses relations et ses biens passent à ses proches."]);
      succession(ctx, e);
    }
  }
}

function succession(ctx: Ctx, dead: Entity) {
  const all = [...ctx.relations, ...ctx.newRelations];
  const ruled = all.filter(r => r.type === "rules" && r.sourceId === dead.id && r.untilTick == null && !ctx.endedRelations.has(r.id));
  for (const rel of ruled) {
    const realm = ctx.ents.get(rel.targetId);
    if (!realm || realm.status !== "active") continue;
    endRelation(ctx, rel);
    const heirRel = all.find(r => r.type === "parent_of" && r.sourceId === dead.id && ctx.ents.get(r.targetId)?.status === "active");
    const heir = heirRel ? ctx.ents.get(heirRel.targetId) : undefined;
    if (heir) {
      addRelation(ctx, heir.id, realm.id, "rules");
      emit(ctx, "politics", `${heir.name} succède à ${dead.name}`, `${heir.name} hérite du pouvoir sur ${realm.name}.`, [heir.id, realm.id, dead.id]);
    } else {
      realm.data.stability = clamp(num(realm.data.stability, 0.6) - 0.2, 0, 1);
      emit(ctx, "politics", `Crise de succession en ${realm.name}`, `${dead.name} meurt sans héritier ; le pouvoir vacille.`, [realm.id, dead.id], ["La stabilité chute."]);
    }
  }
}

function stepCivilizations(ctx: Ctx, dt: number) {
  const civs = sorted(ctx.ents).filter(e => e.kind === "civilization" && e.status === "active");
  const resources = sorted(ctx.ents).filter(e => e.kind === "resource" && e.status === "active");

  for (const civ of civs) {
    const d = civ.data;
    let pop = num(d.population, 10000);
    let tech = Math.min(num(d.techLevel, ctx.c.technology.maxLevel), ctx.c.technology.maxLevel);
    let stability = num(d.stability, 0.6);
    const wealth = num(d.wealth, 0.5);
    const near = resources.filter(r => civOf(r, ctx.ents)?.id === civ.id || distance(r, civ) < 20);
    const resFactor = near.length ? near.reduce((s, r) => s + (r.data.depleted ? 0 : num(r.data.abundance, 0.5)), 0) / near.length : 0.45;
    const atWar = [...ctx.relations, ...ctx.newRelations].some(r => r.type === "war" && r.untilTick == null && !ctx.endedRelations.has(r.id) && (r.sourceId === civ.id || r.targetId === civ.id));

    const K = 40000 * (1 + tech) * (0.5 + resFactor);
    const rate = 0.02 * (0.4 + resFactor) * (0.4 + stability) - (atWar ? 0.02 : 0.004);
    pop = Math.max(0, pop + rate * pop * (1 - pop / K) * dt);

    // Technology advances, never beyond what the laws allow.
    if (tech < ctx.c.technology.maxLevel) {
      const pYear = 0.006 * (0.5 + wealth) * Math.pow(Math.max(pop, 1) / 50000, 0.3) * (0.5 + stability);
      if (ctx.r.chance(1 - Math.pow(1 - pYear, dt))) {
        tech += 1;
        ctx.stats.techAdvances++;
        emit(ctx, "tech", `${civ.name} atteint le niveau technologique ${tech}`, `Savants et artisans de ${civ.name} franchissent un palier (${tech}/10).`, [civ.id], ["Productivité et puissance militaire accrues."]);
      }
    }

    // Stability drifts back to its baseline, more nervous when poor or at war.
    stability += (0.6 - stability) * 0.15 * dt + (ctx.r.next() - 0.5) * 0.12 * Math.sqrt(dt) - (atWar ? 0.05 * dt : 0) - (resFactor < 0.25 ? 0.04 * dt : 0);
    stability = clamp(stability, 0, 1);
    if (stability < 0.12) {
      const prev = typeof d.government === "string" ? d.government : "ancien régime";
      const next = ctx.r.pick(GOVERNMENTS.filter(g => g !== prev));
      d.government = next;
      stability = 0.5;
      emit(ctx, "politics", `Révolution en ${civ.name}`, `L'ordre ancien (${prev}) s'effondre ; ${civ.name} devient une ${next}.`, [civ.id], ["Nouvelles lois locales.", "Une partie de l'élite est exilée."]);
    }

    d.population = Math.round(pop);
    d.techLevel = tech;
    d.stability = Math.round(stability * 1000) / 1000;
    d.territoryRadius = Math.round(clamp(4 + Math.sqrt(pop) / 18, 4, 40) * 10) / 10;

    // Notable births, if the creator allows NPCs.
    if (ctx.c.npcs.allowed && ctx.newEntities.length < 30) {
      const pBirth = 0.02 * Math.sqrt(Math.max(pop, 1) / 100000);
      if (ctx.r.chance(1 - Math.pow(1 - pBirth, dt))) birth(ctx, civ);
    }
  }

  // Diplomacy between pairs.
  for (let i = 0; i < civs.length; i++) for (let j = i + 1; j < civs.length; j++) {
    const a = civs[i], b = civs[j];
    if (a.status !== "active" || b.status !== "active") continue;
    const proximity = clamp(1 - distance(a, b) / 70, 0.05, 1);
    const war = activeRel(ctx, a.id, b.id, "war");
    const ally = activeRel(ctx, a.id, b.id, "ally");
    if (war) {
      const pa = num(a.data.population, 1) * (1 + num(a.data.techLevel, 0)) * num(a.data.stability, 0.5);
      const pb = num(b.data.population, 1) * (1 + num(b.data.techLevel, 0)) * num(b.data.stability, 0.5);
      a.data.population = Math.round(num(a.data.population, 0) * (1 - 0.015 * dt));
      b.data.population = Math.round(num(b.data.population, 0) * (1 - 0.015 * dt));
      if (ctx.r.chance(1 - Math.pow(0.7, dt))) {
        endRelation(ctx, war);
        const [winner, loser] = pa >= pb ? [a, b] : [b, a];
        loser.data.territoryRadius = Math.max(3, num(loser.data.territoryRadius, 8) * 0.8);
        loser.data.stability = clamp(num(loser.data.stability, 0.5) - 0.15, 0, 1);
        emit(ctx, "peace", `Paix entre ${a.name} et ${b.name}`, `La guerre s'achève à l'avantage de ${winner.name}. ${loser.name} cède des terres.`, [a.id, b.id], [`${loser.name} perd du territoire.`, `${winner.name} gagne en prestige.`]);
      }
    } else if (!ally) {
      const scarcity = (num(a.data.stability, 0.6) < 0.35 ? 0.5 : 0) + (num(b.data.stability, 0.6) < 0.35 ? 0.5 : 0);
      const rival = activeRel(ctx, a.id, b.id, "rival") || activeRel(ctx, a.id, b.id, "enemy") ? 1.5 : 0;
      const pWar = 0.012 * proximity * (1 + scarcity + rival);
      const pAlly = 0.01 * proximity * (rival ? 0.2 : 1);
      if (ctx.r.chance(1 - Math.pow(1 - pWar, dt))) {
        addRelation(ctx, a.id, b.id, "war");
        ctx.stats.wars++;
        emit(ctx, "war", `Guerre entre ${a.name} et ${b.name}`, `Les tensions frontalières dégénèrent : ${a.name} et ${b.name} entrent en guerre.`, [a.id, b.id], ["Population et stabilité diminuent des deux côtés."]);
      } else if (ctx.r.chance(1 - Math.pow(1 - pAlly, dt))) {
        addRelation(ctx, a.id, b.id, "ally");
        ctx.stats.alliances++;
        emit(ctx, "alliance", `Alliance entre ${a.name} et ${b.name}`, `${a.name} et ${b.name} scellent un pacte.`, [a.id, b.id], ["Commerce facilité.", "Défense mutuelle."]);
      }
    }
  }
}

function birth(ctx: Ctx, civ: Entity) {
  const name = nameFor(civ.name, ctx.r);
  const id = ctx.r.uuid();
  const settlements = sorted(ctx.ents).filter(e => (e.kind === "city" || e.kind === "village") && e.status === "active" && civOf(e, ctx.ents)?.id === civ.id);
  const home = settlements.length ? ctx.r.pick(settlements) : undefined;
  const all = [...ctx.relations, ...ctx.newRelations];
  const ruler = all.find(r => r.type === "rules" && r.targetId === civ.id && r.untilTick == null && ctx.ents.get(r.sourceId)?.status === "active");
  const isHeir = ruler && ctx.r.chance(0.35);
  const now = ctx.now;
  const e: Entity = {
    id, worldId: ctx.worldId, kind: "npc", name, summary: isHeir ? `Enfant de ${ctx.ents.get(ruler!.sourceId)!.name}, héritier(e) de ${civ.name}.` : `Né(e) parmi le peuple de ${civ.name}${home ? `, à ${home.name}` : ""}.`,
    parentId: home?.id ?? civ.id, x: home?.x ?? civ.x, y: home?.y ?? civ.y, status: "active", importance: isHeir ? 3 : 2,
    data: { age: 0, civilizationId: civ.id, origin: civ.name, generatedBy: "time-engine" }, imageUrl: null, bornTick: ctx.tick, endedTick: null,
    tensions: [], version: 1, createdBy: null, createdAt: now, updatedAt: now
  };
  ctx.ents.set(id, e);
  ctx.newEntities.push(e);
  ctx.stats.births++;
  if (isHeir) addRelation(ctx, ruler!.sourceId, id, "parent_of");
  addRelation(ctx, id, civ.id, "member_of");
  emit(ctx, "birth", `Naissance de ${name}`, e.summary, [id, civ.id]);
}

function stepSettlements(ctx: Ctx, dt: number) {
  for (const s of sorted(ctx.ents)) {
    if ((s.kind !== "city" && s.kind !== "village") || s.status !== "active") continue;
    const civ = civOf(s, ctx.ents);
    let pop = num(s.data.population, s.kind === "city" ? 8000 : 400);
    const before = tierOf(pop);
    const rate = civ ? 0.016 * (0.3 + num(civ.data.stability, 0.6)) - 0.004 : 0.008;
    pop = Math.max(0, pop * Math.exp(rate * dt));
    s.data.population = Math.round(pop);
    const after = tierOf(pop);
    s.data.tier = after;
    if (after !== before) {
      const up = SETTLEMENT_TIERS.findIndex(t => t[1] === after) > SETTLEMENT_TIERS.findIndex(t => t[1] === before);
      if (up && s.kind === "village" && pop >= 8000) s.kind = "city";
      emit(ctx, up ? "growth" : "decline", up ? `${s.name} devient ${after === "ville" || after === "cité" || after === "métropole" ? "une" : "un"} ${after}` : `${s.name} décline`, up ? `${s.name} compte désormais ${fmt(pop)} habitants.` : `${s.name} n'est plus qu'un(e) ${after} de ${fmt(pop)} âmes.`, [s.id]);
    }
    if (pop < 25) {
      s.status = "destroyed";
      s.endedTick = ctx.tick;
      emit(ctx, "decline", `${s.name} est abandonné(e)`, `Les derniers habitants quittent ${s.name}. Il n'en reste que des ruines.`, [s.id]);
    }
  }
}

function stepResources(ctx: Ctx, dt: number) {
  const consumers = sorted(ctx.ents).filter(e => (e.kind === "city" || e.kind === "village" || e.kind === "civilization") && e.status === "active");
  for (const r of sorted(ctx.ents)) {
    if (r.kind !== "resource" || r.status !== "active") continue;
    const capacity = num(r.data.capacity, 1000 * num(r.data.abundance, 0.5) * 2);
    let stock = num(r.data.stock, capacity);
    const users = consumers.filter(c => civOf(r, ctx.ents)?.id === c.id || distance(c, r) < 15);
    const demand = users.reduce((s, c) => s + num(c.data.population, 0), 0) / 2000;
    const renewable = r.data.renewable !== false;
    stock += (renewable ? capacity * 0.08 : 0) * dt - demand * dt;
    stock = clamp(stock, 0, capacity);
    const wasDepleted = r.data.depleted === true;
    r.data.stock = Math.round(stock);
    r.data.capacity = Math.round(capacity);
    if (stock <= 0 && !wasDepleted) {
      r.data.depleted = true;
      emit(ctx, "depletion", `${r.name} est épuisé(e)`, `L'exploitation excessive a vidé ${r.name}.`, [r.id, ...users.map(u => u.id).slice(0, 4)], ["Les établissements voisins perdent en stabilité.", "Des habitants migrent."]);
      for (const u of users) u.data.stability = clamp(num(u.data.stability, 0.6) - 0.1, 0, 1);
      migrate(ctx, users);
    } else if (wasDepleted && stock > capacity * 0.3) {
      r.data.depleted = false;
      emit(ctx, "growth", `${r.name} se reconstitue`, `${r.name} redevient exploitable.`, [r.id]);
    }
  }
}

function migrate(ctx: Ctx, from: Entity[]) {
  const towns = from.filter(e => e.kind === "city" || e.kind === "village");
  for (const t of towns) {
    const civ = civOf(t, ctx.ents);
    const dest = sorted(ctx.ents).find(e => e.id !== t.id && (e.kind === "city" || e.kind === "village") && e.status === "active" && (!civ || civOf(e, ctx.ents)?.id === civ.id) && !from.includes(e));
    if (!dest) continue;
    const moving = Math.round(num(t.data.population, 0) * 0.2);
    if (moving < 10) continue;
    t.data.population = num(t.data.population, 0) - moving;
    dest.data.population = num(dest.data.population, 0) + moving;
    emit(ctx, "migration", `Exode de ${t.name} vers ${dest.name}`, `${fmt(moving)} habitants quittent ${t.name} pour ${dest.name}.`, [t.id, dest.id]);
  }
}

function stepCatastrophes(ctx: Ctx, dt: number) {
  const towns = sorted(ctx.ents).filter(e => (e.kind === "city" || e.kind === "village") && e.status === "active");
  if (!towns.length) return;
  if (!ctx.r.chance(1 - Math.pow(1 - 0.03, dt))) return;
  const [title, desc] = ctx.r.pick(CATASTROPHES[ctx.c.climate] ?? CATASTROPHES["tempéré"]);
  const t = ctx.r.pick(towns);
  const loss = ctx.r.range(0.08, 0.3);
  t.data.population = Math.round(num(t.data.population, 0) * (1 - loss));
  const civ = civOf(t, ctx.ents);
  if (civ) civ.data.stability = clamp(num(civ.data.stability, 0.6) - 0.08, 0, 1);
  ctx.stats.catastrophes++;
  emit(ctx, "catastrophe", `${title} à ${t.name}`, `${desc} ${t.name} perd ${Math.round(loss * 100)} % de sa population.`, [t.id, ...(civ ? [civ.id] : [])], ["Reconstruction nécessaire."]);
}

function stepQuests(ctx: Ctx) {
  for (const q of sorted(ctx.ents)) {
    if (q.kind !== "quest" || q.status !== "active") continue;
    const deadline = typeof q.data.deadlineTick === "number" ? q.data.deadlineTick : null;
    if (deadline != null && ctx.tick >= deadline) {
      q.status = "failed";
      q.endedTick = ctx.tick;
      emit(ctx, "quest", `Échec de la quête « ${q.name} »`, "Le délai est passé sans que la quête soit accomplie.", [q.id]);
    }
  }
}

function sorted(m: Map<string, Entity>): Entity[] {
  return [...m.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function totalPopulation(ents: Iterable<Entity>): number {
  let s = 0;
  for (const e of ents) if (e.kind === "civilization" && e.status === "active") s += num(e.data.population, 0);
  return Math.round(s);
}

/* ---------------------------------------------------------------- entry */

export function simulate(state: WorldState, durationTicks: number, opts: { seed?: number; now?: string } = {}): SimulationResult {
  const { world } = state;
  const c = world.constitution;
  const dpy = c.calendar.daysPerYear;
  const fromTick = world.tick;
  const toTick = fromTick + Math.max(1, Math.floor(durationTicks));
  const fingerprint = state.entities.map(e => `${e.id}:${e.version}`).sort().join("|");
  const seed = opts.seed ?? hash32(`${world.id}|${fromTick}|${toTick}|${hash32(fingerprint)}`);
  const r = rng(seed);

  const originals = new Map(state.entities.map(e => [e.id, e]));
  const ents = new Map(state.entities.map(e => [e.id, { ...e, data: structuredClone(e.data) }]));
  // Beings declared with an age but no birth date get one, so they can age.
  for (const e of ents.values()) {
    if ((e.kind === "character" || e.kind === "npc" || e.kind === "animal") && e.bornTick == null && typeof e.data.age === "number") {
      e.bornTick = fromTick - Math.round((e.data.age as number) * dpy);
    }
  }

  const ctx: Ctx = {
    c, r, tick: fromTick, dpy, events: [], ents, originals,
    relations: state.relations.map(x => ({ ...x })), newRelations: [], endedRelations: new Map(), newEntities: [],
    stats: { births: 0, deaths: 0, wars: 0, alliances: 0, catastrophes: 0, techAdvances: 0, populationBefore: totalPopulation(state.entities), populationAfter: 0 },
    worldId: world.id, simId: `${seed}`, now: opts.now ?? new Date().toISOString()
  };

  const span = toTick - fromTick;
  const stepLen = span <= 31 ? span : span <= 400 ? Math.max(1, Math.round(dpy / 12)) : Math.max(dpy, Math.ceil(span / MAX_STEPS));
  let steps = 0;
  while (ctx.tick < toTick) {
    const len = Math.min(stepLen, toTick - ctx.tick);
    ctx.tick += len;
    const dt = len / dpy;
    stepBeings(ctx, dt);
    stepCivilizations(ctx, dt);
    stepSettlements(ctx, dt);
    stepResources(ctx, dt);
    stepCatastrophes(ctx, dt);
    stepQuests(ctx);
    steps++;
  }

  // Changes against the original rows (new entities are reported separately).
  const changes: EntityChange[] = [];
  for (const e of ents.values()) {
    const o = originals.get(e.id);
    if (!o) continue;
    const before: Partial<Entity> = {}, after: Partial<Entity> = {};
    if (o.status !== e.status) { before.status = o.status; after.status = e.status; after.endedTick = e.endedTick; }
    if (o.kind !== e.kind) { before.kind = o.kind; after.kind = e.kind; }
    if (o.bornTick !== e.bornTick) { before.bornTick = o.bornTick; after.bornTick = e.bornTick; }
    if (JSON.stringify(o.data) !== JSON.stringify(e.data)) { before.data = o.data; after.data = e.data; }
    if (Object.keys(after).length) changes.push({ id: e.id, name: e.name, before, after });
  }

  // One demographic summary per civilization, rather than a line per month.
  for (const civ of [...ents.values()].filter(e => e.kind === "civilization")) {
    const o = originals.get(civ.id);
    if (!o) continue;
    const p0 = num(o.data.population, 10000), p1 = num(civ.data.population, p0);
    if (Math.abs(p1 - p0) / Math.max(p0, 1) > 0.02) {
      ctx.tick = toTick;
      emit(ctx, p1 > p0 ? "growth" : "decline", `${civ.name} : ${fmt(p0)} → ${fmt(p1)} habitants`, `En ${Math.round(span / dpy * 10) / 10} an(s), la population de ${civ.name} ${p1 > p0 ? "croît" : "diminue"} de ${Math.round(Math.abs(p1 - p0) / Math.max(p0, 1) * 100)} %.`, [civ.id]);
    }
  }
  ctx.stats.populationAfter = totalPopulation(ents.values());
  if (!ctx.events.length) {
    ctx.tick = toTick;
    emit(ctx, "simulation", "Le temps passe", `${span} jour(s) s'écoulent sans événement marquant.`, []);
  }
  ctx.events.sort((a, b) => a.tick - b.tick);

  return {
    id: r.uuid(), worldId: world.id, fromTick, toTick, seed, steps,
    events: ctx.events, changes, newEntities: ctx.newEntities,
    newRelations: ctx.newRelations,
    endedRelations: [...ctx.endedRelations.entries()].map(([id, untilTick]) => ({ id, untilTick })),
    stats: ctx.stats
  };
}
