import "server-only";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceClient } from "@/lib/supabase/server";
import { rankCandidates, type MatchCandidate } from "@/lib/matching";
import { AIError, getProvider } from "./provider";
import { PROMPTS, wrapUserData } from "./prompts";
import {
  AI_FEATURES,
  BusinessPlanSchema,
  CostEstimateSchema,
  EventPlanSchema,
  IdeaStructureSchema,
  NextActionsSchema,
  PartnersSchema,
  PeopleRecommendationSchema,
  RoadmapSchema,
  type AIFeature,
} from "./schemas";

type DB = SupabaseClient<Database>;

export type Quota = { plan: string; monthly_credits: number; used: number; remaining: number };

export async function getQuota(db: DB): Promise<Quota | null> {
  const { data } = await db.rpc("ai_quota");
  return (data?.[0] as Quota | undefined) ?? null;
}

async function recordUsage(userId: string, feature: AIFeature, usage: { inputTokens: number; outputTokens: number; provider: string; model: string }) {
  const admin = createServiceClient();
  const { error } = await admin.from("ai_usage").insert({
    user_id: userId,
    feature,
    credits: AI_FEATURES[feature].credits,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    provider: usage.provider,
    model: usage.model,
  });
  if (error) console.error("[venture-ai] failed to record usage", error);
}

/** Loads project context the caller is allowed to see (RLS-scoped). */
async function loadProjectContext(db: DB, projectId: string, userId: string) {
  const { data: project } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) throw new AIError("invalid_output", "Projet introuvable.");
  const { data: me } = await db.from("project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  if (!me) throw new AIError("invalid_output", "VENTURE AI est réservé aux membres de l'équipe du projet.");
  const [{ data: milestones }, { data: tasks }, { data: members }, { data: event }, { count: pendingApplications }] = await Promise.all([
    db.from("milestones").select("title, done, due_date").eq("project_id", projectId).order("position"),
    db.from("tasks").select("title, status, due_date").eq("project_id", projectId).limit(100),
    db.from("project_members").select("role, responsibility, profiles(display_name, skills)").eq("project_id", projectId),
    db.from("event_details").select("*").eq("project_id", projectId).maybeSingle(),
    db.from("applications").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
  ]);
  return {
    role: me.role,
    project,
    context: {
      titre: project.title,
      description: project.description,
      categorie: project.category,
      statut: project.status,
      objectif: project.goal,
      objectif_interet: project.interest_goal,
      personnes_interessees: project.interest_count,
      participants_confirmes: project.participant_count,
      competences_recherchees: project.skills_needed,
      ressources_recherchees: project.resources_needed,
      budget_estime_eur: project.budget_estimate_cents != null ? project.budget_estimate_cents / 100 : null,
      ville: project.city,
      a_distance: project.is_remote,
      etapes: milestones ?? [],
      taches: tasks ?? [],
      equipe: (members ?? []).map((m) => ({
        nom: (m.profiles as { display_name: string } | null)?.display_name,
        role: m.role,
        responsabilite: m.responsibility,
        competences: (m.profiles as { skills: string[] } | null)?.skills ?? [],
      })),
      candidatures_en_attente: pendingApplications ?? 0,
      evenement: event
        ? { etape: event.stage, lieu_envisage: event.venue_idea, capacite: event.capacity, prix_min_eur: event.price_min_cents != null ? event.price_min_cents / 100 : null, prix_max_eur: event.price_max_cents != null ? event.price_max_cents / 100 : null, dates_envisagees: event.date_options }
        : null,
    },
  };
}

export type AIRunResult = { feature: AIFeature; data: unknown; creditsUsed: number; remaining: number | null };

export async function runAIFeature(
  db: DB,
  userId: string,
  feature: AIFeature,
  input: { idea?: string; projectId?: string },
): Promise<AIRunResult> {
  const cost = AI_FEATURES[feature].credits;
  const quota = await getQuota(db);
  if (!quota) throw new AIError("not_configured", "Quota introuvable.");
  if (quota.remaining < cost) {
    throw new AIError("rate_limited", `Crédits IA insuffisants ce mois-ci (${quota.remaining} restants, ${cost} nécessaires). Passe à VENTURE Plus pour en obtenir davantage.`);
  }

  const provider = await getProvider();
  let schema: z.ZodType;
  let user: string;
  let postProcess: (d: unknown) => unknown = (d) => d;

  if (feature === "structure_idea") {
    const idea = (input.idea ?? "").trim();
    if (idea.length < 10 || idea.length > 2000) throw new AIError("invalid_output", "Décris ton idée en 10 à 2000 caractères.");
    schema = IdeaStructureSchema;
    user = `Voici l'envie de l'utilisateur :\n${wrapUserData("idee", { idee: idea })}`;
  } else {
    if (!input.projectId) throw new AIError("invalid_output", "Projet manquant.");
    const { context, role, project } = await loadProjectContext(db, input.projectId, userId);
    user = `Projet :\n${wrapUserData("projet", context)}`;
    switch (feature) {
      case "roadmap":
        schema = RoadmapSchema;
        break;
      case "next_actions":
        schema = NextActionsSchema;
        break;
      case "cost_estimate":
        schema = CostEstimateSchema;
        break;
      case "business_plan":
        schema = BusinessPlanSchema;
        break;
      case "event_plan":
        schema = EventPlanSchema;
        break;
      case "partners": {
        schema = PartnersSchema;
        const { data: opps } = await db
          .from("opportunities")
          .select("id, kind, title, description, skills, city, is_remote")
          .eq("is_open", true)
          .eq("moderation", "visible")
          .order("created_at", { ascending: false })
          .limit(40);
        const ids = new Set((opps ?? []).map((o) => o.id));
        user += `\n\nOpportunités publiées sur VENTURE (seules références autorisées) :\n${wrapUserData("opportunites", opps ?? [])}`;
        postProcess = (d) => {
          const p = d as z.infer<typeof PartnersSchema>;
          return { ...p, matching_opportunity_ids: p.matching_opportunity_ids.filter((id) => ids.has(id)), opportunities: (opps ?? []).filter((o) => p.matching_opportunity_ids.includes(o.id)) };
        };
        break;
      }
      case "recommend_people": {
        if (role !== "owner" && role !== "admin") throw new AIError("invalid_output", "Réservé au créateur et aux administrateurs du projet.");
        schema = PeopleRecommendationSchema;
        const { data: rows, error } = await db.rpc("matching_candidates", { p_project: input.projectId, p_limit: 200 });
        if (error) throw new AIError("upstream", "Impossible de charger les candidats.");
        // Pre-rank deterministically; the model only explains/prioritises a shortlist of real members.
        const ranked = rankCandidates(
          { title: project.title, description: project.description, category: project.category, skills_needed: project.skills_needed, is_remote: project.is_remote, has_location: project.lat != null },
          (rows ?? []) as MatchCandidate[],
          25,
        );
        if (ranked.length === 0) {
          return { feature, data: { recommendations: [], uncovered_needs: project.skills_needed, profiles: [] }, creditsUsed: 0, remaining: quota.remaining };
        }
        const byId = new Map(ranked.map((r) => [r.candidate.id, r]));
        user += `\n\nCandidats (membres réels, découvrables) :\n${wrapUserData(
          "candidats",
          ranked.map((r) => ({ user_id: r.candidate.id, nom: r.candidate.display_name, competences: r.candidate.skills, interets: r.candidate.interests, disponibilite: r.candidate.availability, distance_km: r.candidate.distance_km, deja_interesse: r.candidate.is_interested })),
        )}`;
        postProcess = (d) => {
          const p = d as z.infer<typeof PeopleRecommendationSchema>;
          const recs = p.recommendations.filter((r) => byId.has(r.user_id)); // drop any invented id
          return {
            ...p,
            recommendations: recs,
            profiles: recs.map((r) => {
              const c = byId.get(r.user_id)!.candidate;
              return { id: c.id, username: c.username, display_name: c.display_name, avatar_url: c.avatar_url };
            }),
          };
        };
        break;
      }
      default:
        throw new AIError("invalid_output", "Fonctionnalité inconnue.");
    }
  }

  const result = await provider.generate({ system: PROMPTS[feature], user, schema });
  await recordUsage(userId, feature, result.usage);
  return { feature, data: postProcess(result.data), creditsUsed: cost, remaining: quota.remaining - cost };
}
