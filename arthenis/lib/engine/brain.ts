/**
 * WORLD BRAIN — the memory of a world.
 *
 * It reads the structured canon (entities, relations, timeline, laws), not a
 * chat transcript. Retrieval is deterministic (lexical scoring + graph
 * expansion), so the AI layer is only ever handed the facts that matter, and
 * can be asked to cite them. Without an AI key the Brain still answers from
 * those facts.
 */
import { KIND_LABEL, pathOf } from "./hierarchy";
import { formatTick, lawsAsText } from "./constitution";
import { norm } from "./text";
import type { Entity, Relation, RelationType, TimelineEvent, WorldState } from "./types";

export const RELATION_LABEL: Record<RelationType, string> = {
  member_of: "appartient à", rules: "gouverne", ally: "est allié(e) de", war: "est en guerre contre",
  trade: "commerce avec", rival: "est rival(e) de", enemy: "est ennemi(e) de", parent_of: "est parent de",
  spouse: "est marié(e) à", friend: "est ami(e) de", worships: "vénère", speaks: "parle", owns: "possède",
  knows: "connaît", serves: "sert", origin: "est originaire de"
};

export type Fact = { id: string; text: string; score: number; entityIds: string[]; kind: "law" | "entity" | "relation" | "event" };

export type BrainAnswer = {
  facts: Fact[];
  entities: Entity[];
  paths: Array<{ from: string; to: string; steps: string[] }>;
  answer: string;
};

const STOP = new Set("le la les un une des de du d l et ou a au aux en dans sur pour par avec que qui quoi quel quelle quels quelles est sont il elle ils elles ce cette ces son sa ses leur leurs comment pourquoi quand ou y se ne pas plus moins tres monde".split(" "));

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(t => t.length > 1 && !STOP.has(t));
}

export class WorldBrain {
  readonly byId: Map<string, Entity>;
  private adj = new Map<string, Relation[]>();

  constructor(readonly state: WorldState) {
    this.byId = new Map(state.entities.map(e => [e.id, e]));
    for (const r of state.relations) {
      for (const k of [r.sourceId, r.targetId]) {
        if (!this.adj.has(k)) this.adj.set(k, []);
        this.adj.get(k)!.push(r);
      }
    }
  }

  relationText(r: Relation): string {
    const a = this.byId.get(r.sourceId)?.name ?? "?";
    const b = this.byId.get(r.targetId)?.name ?? "?";
    const c = this.state.world.constitution;
    const when = r.untilTick != null ? ` (du ${formatTick(r.sinceTick, c)} au ${formatTick(r.untilTick, c)})` : "";
    return `${a} ${RELATION_LABEL[r.type] ?? r.type} ${b}${when}`;
  }

  describe(e: Entity): string {
    const c = this.state.world.constitution;
    const path = pathOf(e, this.byId).slice(0, -1).map(p => p.name);
    const bits = [`${KIND_LABEL[e.kind]} « ${e.name} »`];
    if (path.length) bits.push(`situé(e) dans ${path.join(" › ")}`);
    if (e.summary) bits.push(e.summary);
    const d = e.data;
    if (typeof d.age === "number") bits.push(`${d.age} ans`);
    if (typeof d.population === "number") bits.push(`${Math.round(d.population as number).toLocaleString("fr-FR")} habitants`);
    if (typeof d.government === "string") bits.push(`régime : ${d.government}`);
    if (typeof d.techLevel === "number") bits.push(`technologie ${d.techLevel}/10`);
    if (e.status !== "active") bits.push(`statut : ${e.status}${e.endedTick != null ? ` depuis le ${formatTick(e.endedTick, c)}` : ""}`);
    return bits.join(" — ");
  }

  relationsOf(id: string, includeEnded = true): Relation[] {
    return (this.adj.get(id) ?? []).filter(r => includeEnded || r.untilTick == null);
  }

  eventsOf(id: string): TimelineEvent[] {
    return this.state.events.filter(e => e.entityIds.includes(id)).sort((a, b) => a.tick - b.tick);
  }

  /** Shortest relation path between two entities (hierarchy counts as a link). */
  path(fromId: string, toId: string, maxDepth = 5): string[] | null {
    if (fromId === toId) return [];
    const prev = new Map<string, { via: string; from: string }>();
    const queue: Array<[string, number]> = [[fromId, 0]];
    const seen = new Set([fromId]);
    while (queue.length) {
      const [cur, depth] = queue.shift()!;
      if (depth >= maxDepth) continue;
      const links: Array<[string, string]> = this.relationsOf(cur).map(r => [r.sourceId === cur ? r.targetId : r.sourceId, this.relationText(r)]);
      const e = this.byId.get(cur);
      if (e?.parentId) links.push([e.parentId, `${e.name} se trouve dans ${this.byId.get(e.parentId)?.name}`]);
      for (const child of this.state.entities) if (child.parentId === cur) links.push([child.id, `${child.name} se trouve dans ${e?.name}`]);
      for (const [nxt, label] of links) {
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        prev.set(nxt, { via: label, from: cur });
        if (nxt === toId) {
          const steps: string[] = [];
          let k = toId;
          while (k !== fromId) { const p = prev.get(k)!; steps.unshift(p.via); k = p.from; }
          return steps;
        }
        queue.push([nxt, depth + 1]);
      }
    }
    return null;
  }

  /** Scores every fact against the question, then expands one hop around the best entities. */
  retrieve(question: string, limit = 14): Fact[] {
    const q = tokens(question);
    const qs = new Set(q);
    const facts: Fact[] = [];
    const score = (text: string, boost = 0) => {
      const t = tokens(text);
      let s = 0;
      for (const w of t) if (qs.has(w)) s += 1;
      for (const w of q) if (w.length > 4 && t.some(x => x.startsWith(w.slice(0, 5)))) s += 0.4;
      return s + boost;
    };
    const c = this.state.world.constitution;
    const lawQuestion = /\b(loi|lois|regle|regles|magie|technologie|interdit|autorise|constitution|physique)\b/.test(norm(question));
    for (const l of lawsAsText(c)) facts.push({ id: `law:${l.key}`, kind: "law", text: `Loi — ${l.title} : ${l.text}`, entityIds: [], score: score(`${l.title} ${l.text}`, lawQuestion ? 1 : 0) });

    const nameHits = new Set<string>();
    const nq = ` ${norm(question)} `;
    for (const e of this.state.entities) {
      if (e.status === "archived") continue;
      const nameMatch = nq.includes(` ${norm(e.name)} `) || (norm(e.name).length > 3 && nq.includes(norm(e.name)));
      if (nameMatch) nameHits.add(e.id);
      const kindBoost = q.some(w => norm(KIND_LABEL[e.kind]).startsWith(w.slice(0, 5))) ? 0.8 : 0;
      facts.push({ id: `entity:${e.id}`, kind: "entity", text: this.describe(e), entityIds: [e.id], score: score(`${e.name} ${e.summary} ${KIND_LABEL[e.kind]}`, (nameMatch ? 5 : 0) + kindBoost + e.importance * 0.05) });
    }
    for (const r of this.state.relations) {
      const s = (nameHits.has(r.sourceId) ? 2 : 0) + (nameHits.has(r.targetId) ? 2 : 0);
      facts.push({ id: `rel:${r.id}`, kind: "relation", text: this.relationText(r), entityIds: [r.sourceId, r.targetId], score: score(this.relationText(r), s) });
    }
    for (const ev of this.state.events) {
      if (!ev.canon) continue;
      const s = ev.entityIds.some(id => nameHits.has(id)) ? 1.5 : 0;
      facts.push({ id: `event:${ev.id}`, kind: "event", text: `${formatTick(ev.tick, c)} — ${ev.title}. ${ev.description}`, entityIds: ev.entityIds, score: score(`${ev.title} ${ev.description}`, s) });
    }
    const ranked = facts.filter(f => f.score > 0.3).sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit);
  }

  ask(question: string): BrainAnswer {
    const facts = this.retrieve(question);
    const ids = [...new Set(facts.flatMap(f => f.entityIds))];
    const entities = ids.map(id => this.byId.get(id)).filter((e): e is Entity => Boolean(e)).slice(0, 8);
    const named = entities.filter(e => ` ${norm(question)} `.includes(norm(e.name)));
    const paths: BrainAnswer["paths"] = [];
    if (named.length >= 2) {
      const steps = this.path(named[0].id, named[1].id);
      if (steps) paths.push({ from: named[0].name, to: named[1].name, steps });
    }
    let answer: string;
    if (!facts.length) answer = "Le World Brain ne trouve rien à ce sujet dans le canon de ce monde. Rien n'a encore été établi : c'est une page blanche à écrire.";
    else {
      const lines = facts.slice(0, 6).map(f => `• ${f.text}`);
      if (paths.length) lines.unshift(`Lien entre ${paths[0].from} et ${paths[0].to} : ${paths[0].steps.join(" → ") || "même entité"}.`);
      answer = `D'après le canon établi :\n${lines.join("\n")}`;
    }
    return { facts, entities, paths, answer };
  }

  /** Compact context for an AI prompt: laws first, then the retrieved facts. */
  contextFor(question: string): string {
    const c = this.state.world.constitution;
    const laws = lawsAsText(c).map(l => `- ${l.title} : ${l.text}`).join("\n");
    const facts = this.retrieve(question, 20).filter(f => f.kind !== "law").map(f => `- [${f.id}] ${f.text}`).join("\n");
    return `MONDE : ${this.state.world.name} — ${this.state.world.description}\nPRÉSENT : ${formatTick(this.state.world.tick, c)}\nLOIS :\n${laws}\nFAITS PERTINENTS :\n${facts || "- (aucun)"}`;
  }

  /** Full dossier of one entity: identity, place in the hierarchy, relations, history. */
  dossier(id: string) {
    const e = this.byId.get(id);
    if (!e) return null;
    return {
      entity: e,
      description: this.describe(e),
      path: pathOf(e, this.byId),
      children: this.state.entities.filter(x => x.parentId === id),
      relations: this.relationsOf(id).map(r => ({ relation: r, text: this.relationText(r), other: this.byId.get(r.sourceId === id ? r.targetId : r.sourceId) })),
      events: this.eventsOf(id)
    };
  }

  stats() {
    const count = (k: string) => this.state.entities.filter(e => e.kind === k && e.status !== "archived").length;
    return {
      entities: this.state.entities.filter(e => e.status !== "archived").length,
      places: this.state.entities.filter(e => ["universe", "galaxy", "star_system", "planet", "continent", "country", "region", "city", "village", "place"].includes(e.kind)).length,
      characters: count("character") + count("npc"),
      civilizations: count("civilization"),
      creatures: count("creature") + count("animal"),
      relations: this.state.relations.length,
      events: this.state.events.length,
      tensions: this.state.entities.filter(e => e.tensions.length).length
    };
  }
}
