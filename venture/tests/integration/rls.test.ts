/**
 * Security & business-rule tests against the real local Supabase stack
 * (Postgres + Auth + Storage). Every assertion goes through the public API
 * with a real user JWT, exactly like the browser would.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanup, createUser, type TestUser } from "./helpers";

let owner: TestUser, helper: TestUser, outsider: TestUser, staff: TestUser;
let projectId: string;

beforeAll(async () => {
  owner = await createUser("owner");
  helper = await createUser("helper");
  outsider = await createUser("outsider");
  staff = await createUser("staff");
  await admin.from("profiles").update({ platform_role: "admin" }).eq("id", staff.id);
  await owner.db.from("profiles").update({ skills: ["Organisation"] }).eq("id", owner.id);
  await helper.db.from("profiles").update({ skills: ["Photographie", "DJ"], interests: ["Musique"], is_discoverable: true }).eq("id", helper.id);
  const { data, error } = await owner.db
    .from("projects")
    .insert({ owner_id: owner.id, title: "Festival test intégration", description: "Un festival pour tester les règles de sécurité.", category: "event", skills_needed: ["DJ", "Photographes"], interest_goal: 100 })
    .select("id")
    .single();
  if (error) throw error;
  projectId = data.id;
});

afterAll(async () => cleanup([owner, helper, outsider, staff]));

describe("signup", () => {
  it("rejects minors at the database level, even via the raw Auth API", async () => {
    const { error } = await admin.auth.admin.createUser({ email: `minor.${Date.now()}@test.venture.invalid`, password: "Venture2026Test", email_confirm: true, user_metadata: { birthdate: "2012-01-01", display_name: "Minor" } });
    expect(error).not.toBeNull();
  });
  it("rejects signups without birthdate", async () => {
    const { error } = await anon().auth.signUp({ email: `nobday.${Date.now()}@test.venture.invalid`, password: "Venture2026Test" });
    expect(error).not.toBeNull();
  });
  it("creates profile + private row and keeps the birthdate private", async () => {
    const { data } = await owner.db.from("profile_private").select("birthdate").eq("id", owner.id).single();
    expect(data?.birthdate).toBe("1995-06-15");
    const { data: other } = await helper.db.from("profile_private").select("birthdate").eq("id", owner.id);
    expect(other).toEqual([]);
    const { data: anonView, error } = await anon().from("profile_private").select("*");
    expect(anonView ?? []).toEqual([]);
    expect(error).not.toBeNull(); // anon has no SELECT privilege at all
  });
});

describe("profiles: privilege escalation", () => {
  it("cannot self-assign plan, role, verification or counters", async () => {
    for (const patch of [{ plan: "business" }, { platform_role: "superadmin" }, { is_verified_organizer: true }, { completed_projects_count: 99 }, { is_suspended: false }]) {
      const { error } = await owner.db.from("profiles").update(patch as never).eq("id", owner.id);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    const { data } = await admin.from("profiles").select("plan, platform_role").eq("id", owner.id).single();
    expect(data).toEqual({ plan: "free", platform_role: "user" });
  });
  it("cannot edit someone else's profile", async () => {
    const { data } = await outsider.db.from("profiles").update({ bio: "hacked" }).eq("id", owner.id).select();
    expect(data).toEqual([]);
  });
  it("members-only profiles are hidden from visitors", async () => {
    await helper.db.from("profiles").update({ visibility: "members" }).eq("id", helper.id);
    const { data: v } = await anon().from("profiles").select("id").eq("id", helper.id);
    expect(v).toEqual([]);
    const { data: m } = await outsider.db.from("profiles").select("id").eq("id", helper.id);
    expect(m).toHaveLength(1);
    await helper.db.from("profiles").update({ visibility: "public" }).eq("id", helper.id);
  });
});

describe("projects", () => {
  it("owner becomes a member, a project chat is created, event details exist", async () => {
    const { data: m } = await owner.db.from("project_members").select("role").eq("project_id", projectId).eq("user_id", owner.id).single();
    expect(m?.role).toBe("owner");
    const { data: c } = await owner.db.from("conversations").select("id, kind").eq("project_id", projectId).single();
    expect(c?.kind).toBe("project");
    const { data: e } = await owner.db.from("event_details").select("stage").eq("project_id", projectId).single();
    expect(e?.stage).toBe("proposed");
  });
  it("is publicly readable (feed/search for visitors)", async () => {
    const { data } = await anon().from("projects").select("id").eq("id", projectId);
    expect(data).toHaveLength(1);
  });
  it("cannot be created for someone else, nor with forged counters/demo/sponsor flags", async () => {
    const { error } = await outsider.db.from("projects").insert({ owner_id: owner.id, title: "Usurpation", description: "Projet au nom d'un autre membre", category: "business" });
    expect(error).not.toBeNull();
    const { error: e2 } = await outsider.db.from("projects").insert({ owner_id: outsider.id, title: "Faux chiffres", description: "Tentative de gonfler les compteurs", category: "business", interest_count: 5000, is_demo: true } as never);
    expect(e2).not.toBeNull();
  });
  it("cannot be modified or deleted by a non-manager", async () => {
    const { data } = await outsider.db.from("projects").update({ title: "Piraté" }).eq("id", projectId).select();
    expect(data).toEqual([]);
    const { data: d } = await outsider.db.from("projects").delete().eq("id", projectId).select();
    expect(d).toEqual([]);
  });
  it("is found by search (full-text + skills)", async () => {
    const { data } = await outsider.db.rpc("search_projects", { p_query: "festival intégration" });
    expect((data ?? []).some((p) => p.id === projectId)).toBe(true);
    const { data: bySkill } = await outsider.db.rpc("search_projects", { p_query: "DJ" });
    expect((bySkill ?? []).some((p) => p.id === projectId)).toBe(true);
  });
});

describe("participation flow", () => {
  let appId: string;
  it("interest increments the counter and notifies the owner; individual engagements stay private", async () => {
    const { error } = await helper.db.from("project_engagements").insert({ project_id: projectId, user_id: helper.id, kind: "interested" });
    expect(error).toBeNull();
    const { data: p } = await anon().from("projects").select("interest_count").eq("id", projectId).single();
    expect(p?.interest_count).toBe(1);
    const { data: n } = await owner.db.from("notifications").select("type").eq("type", "interest");
    expect(n?.length).toBeGreaterThan(0);
    const { data: seen } = await outsider.db.from("project_engagements").select("*").eq("project_id", projectId);
    expect(seen).toEqual([]);
    const { error: dup } = await helper.db.from("project_engagements").insert({ project_id: projectId, user_id: helper.id, kind: "interested" });
    expect(dup?.code).toBe("23505");
  });
  it("cannot register interest on behalf of someone else", async () => {
    const { error } = await outsider.db.from("project_engagements").insert({ project_id: projectId, user_id: helper.id, kind: "participating" });
    expect(error).not.toBeNull();
  });
  it("applying notifies managers; only one pending application per user", async () => {
    const { data, error } = await helper.db.from("applications").insert({ project_id: projectId, applicant_id: helper.id, skill: "DJ", message: "Je mixe depuis dix ans, partant !" }).select("id").single();
    expect(error).toBeNull();
    appId = data!.id;
    const { error: dup } = await helper.db.from("applications").insert({ project_id: projectId, applicant_id: helper.id, message: "Deuxième candidature en double" });
    expect(dup).not.toBeNull();
    const { data: n } = await owner.db.from("notifications").select("type").eq("type", "application");
    expect(n?.length).toBe(1);
  });
  it("outsiders can neither see nor decide applications", async () => {
    const { data } = await outsider.db.from("applications").select("*").eq("project_id", projectId);
    expect(data).toEqual([]);
    const { error } = await outsider.db.rpc("decide_application", { p_application: appId, p_accept: true });
    expect(error?.message).toContain("VENTURE_FORBIDDEN");
  });
  it("before acceptance, the applicant has no access to the collaborative space", async () => {
    const { data } = await helper.db.from("tasks").select("*").eq("project_id", projectId);
    expect(data).toEqual([]);
    const { error } = await helper.db.from("tasks").insert({ project_id: projectId, title: "Intrusion", created_by: helper.id });
    expect(error).not.toBeNull();
  });
  it("owner accepts → applicant joins the team and the project chat, and is notified", async () => {
    const { error } = await owner.db.rpc("decide_application", { p_application: appId, p_accept: true });
    expect(error).toBeNull();
    const { data: m } = await helper.db.from("project_members").select("role").eq("project_id", projectId).eq("user_id", helper.id).single();
    expect(m?.role).toBe("member");
    const { data: conv } = await helper.db.from("conversations").select("id").eq("project_id", projectId).single();
    expect(conv?.id).toBeTruthy();
    const { data: n } = await helper.db.from("notifications").select("type").eq("type", "application_accepted");
    expect(n?.length).toBe(1);
    const { error: again } = await owner.db.rpc("decide_application", { p_application: appId, p_accept: true });
    expect(again?.message).toContain("VENTURE_ALREADY_DECIDED");
  });
});

describe("collaborative space", () => {
  let milestoneId: string;
  it("members create and assign tasks; assignee is notified; non-members are rejected", async () => {
    const { error } = await owner.db.from("tasks").insert({ project_id: projectId, title: "Trouver un lieu", created_by: owner.id, assignee_id: helper.id });
    expect(error).toBeNull();
    const { data: t } = await helper.db.from("tasks").select("title").eq("project_id", projectId);
    expect(t?.map((x) => x.title)).toContain("Trouver un lieu");
    const { data: n } = await helper.db.from("notifications").select("type").eq("type", "task_assigned");
    expect(n?.length).toBe(1);
    const { error: bad } = await owner.db.from("tasks").insert({ project_id: projectId, title: "Assignée à un externe", created_by: owner.id, assignee_id: outsider.id });
    expect(bad?.message).toContain("VENTURE_ASSIGNEE_NOT_MEMBER");
  });
  it("progress derives from completed steps; members can tick steps but not restructure them", async () => {
    const { data } = await owner.db.from("milestones").insert([{ project_id: projectId, title: "Étape 1", position: 0 }, { project_id: projectId, title: "Étape 2", position: 1 }]).select("id");
    milestoneId = data![0]!.id;
    const { error: e1 } = await helper.db.from("milestones").insert({ project_id: projectId, title: "Ajout non autorisé" });
    expect(e1).not.toBeNull();
    const { error: e2 } = await helper.db.rpc("set_milestone_done", { p_milestone: milestoneId, p_done: true });
    expect(e2).toBeNull();
    const { data: p } = await anon().from("projects").select("milestones_done, milestones_total").eq("id", projectId).single();
    expect(p).toEqual({ milestones_done: 1, milestones_total: 2 });
    const { error: e3 } = await outsider.db.rpc("set_milestone_done", { p_milestone: milestoneId, p_done: false });
    expect(e3?.message).toContain("VENTURE_FORBIDDEN");
  });
  it("calendar and documents are team-only", async () => {
    await owner.db.from("calendar_events").insert({ project_id: projectId, title: "Réunion", starts_at: new Date(Date.now() + 86400000).toISOString(), created_by: owner.id });
    expect((await helper.db.from("calendar_events").select("id").eq("project_id", projectId)).data).toHaveLength(1);
    expect((await outsider.db.from("calendar_events").select("id").eq("project_id", projectId)).data).toEqual([]);
  });
  it("storage: team files are readable by members only", async () => {
    const path = `${projectId}/plan.txt`;
    const up = await owner.db.storage.from("project-files").upload(path, new Blob(["plan"], { type: "text/plain" }));
    expect(up.error).toBeNull();
    expect((await helper.db.storage.from("project-files").download(path)).error).toBeNull();
    expect((await outsider.db.storage.from("project-files").download(path)).error).not.toBeNull();
    const intrude = await outsider.db.storage.from("project-files").upload(`${projectId}/evil.txt`, new Blob(["x"]));
    expect(intrude.error).not.toBeNull();
  });
  it("storage: avatars can only be written in one's own folder", async () => {
    const own = await outsider.db.storage.from("avatars").upload(`${outsider.id}/a.png`, new Blob(["x"], { type: "image/png" }));
    expect(own.error).toBeNull();
    const other = await outsider.db.storage.from("avatars").upload(`${owner.id}/a.png`, new Blob(["x"], { type: "image/png" }));
    expect(other.error).not.toBeNull();
  });
  it("the owner cannot be removed, admins cannot be self-promoted to owner", async () => {
    const { error } = await owner.db.from("project_members").update({ role: "owner" }).eq("project_id", projectId).eq("user_id", helper.id);
    expect(error?.message).toContain("VENTURE_CANNOT_PROMOTE_OWNER");
    const { data } = await helper.db.from("project_members").delete().eq("project_id", projectId).eq("user_id", owner.id).select();
    expect(data ?? []).toEqual([]);
  });
});

describe("messaging", () => {
  it("project chat: members exchange messages, outsiders cannot read or post", async () => {
    const { data: conv } = await owner.db.from("conversations").select("id").eq("project_id", projectId).single();
    const cid = conv!.id;
    expect((await owner.db.from("messages").insert({ conversation_id: cid, sender_id: owner.id, body: "Bienvenue !" })).error).toBeNull();
    expect((await helper.db.from("messages").insert({ conversation_id: cid, sender_id: helper.id, body: "Merci !" })).error).toBeNull();
    expect((await helper.db.from("messages").select("body").eq("conversation_id", cid)).data?.length).toBe(2);
    expect((await outsider.db.from("messages").select("body").eq("conversation_id", cid)).data).toEqual([]);
    expect((await outsider.db.from("messages").insert({ conversation_id: cid, sender_id: outsider.id, body: "intrusion" })).error).not.toBeNull();
    // Cannot spoof the sender either
    expect((await helper.db.from("messages").insert({ conversation_id: cid, sender_id: owner.id, body: "usurpation" })).error).not.toBeNull();
    const { data: n } = await helper.db.from("notifications").select("type").eq("type", "message");
    expect(n?.length).toBe(1); // deduplicated per conversation
  });
  it("direct messages require a contact request, then work", async () => {
    const { error } = await outsider.db.rpc("get_or_create_direct_conversation", { p_other: owner.id });
    expect(error?.message).toContain("VENTURE_CONTACT_REQUIRED");
    const { data: req } = await outsider.db.from("contact_requests").insert({ from_id: outsider.id, to_id: owner.id, message: "Bonjour, on peut échanger ?" }).select("id").single();
    expect((await helper.db.rpc("respond_contact_request", { p_request: req!.id, p_accept: true })).error?.message).toContain("VENTURE_NOT_FOUND");
    const { data: conv, error: e2 } = await owner.db.rpc("respond_contact_request", { p_request: req!.id, p_accept: true });
    expect(e2).toBeNull();
    const { data: msgs } = await outsider.db.from("messages").select("body").eq("conversation_id", conv!);
    expect(msgs?.[0]?.body).toBe("Bonjour, on peut échanger ?");
    expect((await helper.db.from("messages").select("id").eq("conversation_id", conv!)).data).toEqual([]);
  });
  it("blocking prevents direct messages and new contact requests", async () => {
    const { data: conv } = await owner.db.rpc("get_or_create_direct_conversation", { p_other: outsider.id });
    expect((await owner.db.from("blocks").insert({ blocker_id: owner.id, blocked_id: outsider.id })).error).toBeNull();
    const { error } = await outsider.db.from("messages").insert({ conversation_id: conv!, sender_id: outsider.id, body: "Tu me bloques ?" });
    expect(error?.message).toContain("VENTURE_BLOCKED");
    // Blocks are private to the blocker
    expect((await outsider.db.from("blocks").select("*")).data).toEqual([]);
    await owner.db.from("blocks").delete().eq("blocker_id", owner.id).eq("blocked_id", outsider.id);
  });
});

describe("matching", () => {
  it("only managers can list candidates; coordinates are never exposed", async () => {
    const { error } = await outsider.db.rpc("matching_candidates", { p_project: projectId });
    expect(error?.message).toContain("VENTURE_FORBIDDEN");
    const { data } = await owner.db.rpc("matching_candidates", { p_project: projectId });
    expect(data).toBeTruthy();
    for (const row of data ?? []) {
      expect(row).not.toHaveProperty("lat");
      expect(row.id).not.toBe(helper.id); // already a member
    }
  });
});

describe("moderation & admin", () => {
  it("reports are visible to the reporter and staff only", async () => {
    const { error } = await outsider.db.from("reports").insert({ reporter_id: outsider.id, target_type: "project", target_id: projectId, reason: "spam" });
    expect(error).toBeNull();
    expect((await owner.db.from("reports").select("*")).data).toEqual([]);
    expect((await staff.db.from("reports").select("*").eq("target_id", projectId)).data?.length).toBe(1);
  });
  it("regular users cannot moderate, change roles or read admin data", async () => {
    expect((await outsider.db.rpc("moderate_content", { p_type: "project", p_id: projectId, p_hide: true })).error?.message).toContain("VENTURE_FORBIDDEN");
    expect((await outsider.db.rpc("admin_update_user", { p_user: outsider.id, p_plan: "business" })).error?.message).toContain("VENTURE_FORBIDDEN");
    expect((await outsider.db.rpc("admin_stats")).error?.message).toContain("VENTURE_FORBIDDEN");
    expect((await outsider.db.from("plan_settings").update({ price_cents: 1 }).eq("plan", "plus").select()).data).toEqual([]);
    expect((await outsider.db.from("app_settings").update({ value: true }).eq("key", "regulated_funding_enabled").select()).data).toEqual([]);
  });
  it("admins can hide content (audited); hidden projects disappear for others", async () => {
    expect((await staff.db.rpc("moderate_content", { p_type: "project", p_id: projectId, p_hide: true })).error).toBeNull();
    expect((await anon().from("projects").select("id").eq("id", projectId)).data).toEqual([]);
    expect((await owner.db.from("projects").select("id").eq("id", projectId)).data).toHaveLength(1);
    const { data: log } = await staff.db.from("admin_audit_log").select("action").eq("target_id", projectId);
    expect(log?.[0]?.action).toBe("hide");
    await staff.db.rpc("moderate_content", { p_type: "project", p_id: projectId, p_hide: false });
  });
  it("admins cannot grant roles (superadmin only)", async () => {
    expect((await staff.db.rpc("admin_update_user", { p_user: outsider.id, p_role: "admin" })).error?.message).toContain("VENTURE_FORBIDDEN");
  });
  it("suspended users cannot publish", async () => {
    await staff.db.rpc("admin_update_user", { p_user: outsider.id, p_suspended: true });
    const { error } = await outsider.db.from("comments").insert({ project_id: projectId, author_id: outsider.id, body: "Encore là" });
    expect(error).not.toBeNull();
    await staff.db.rpc("admin_update_user", { p_user: outsider.id, p_suspended: false });
  });
});

describe("business & events", () => {
  it("opportunities require a business account on the Business plan", async () => {
    await outsider.db.rpc("become_business", { p_company: "Acme Test" });
    const row = { company_id: outsider.id, kind: "mission" as const, title: "Mission photo", description: "Couvrir un festival de deux jours en Bretagne." };
    expect((await outsider.db.from("opportunities").insert(row)).error).not.toBeNull();
    await staff.db.rpc("admin_update_user", { p_user: outsider.id, p_plan: "business" });
    expect((await outsider.db.from("opportunities").insert(row)).error).toBeNull();
    const { data: stats, error } = await outsider.db.rpc("community_demand_stats");
    expect(error).toBeNull();
    expect(stats?.some((s) => s.dimension === "category")).toBe(true);
    expect((await helper.db.rpc("community_demand_stats")).error?.message).toContain("VENTURE_PLAN_REQUIRED");
  });
  it("only verified organizers can propose to organize an event", async () => {
    const row = { project_id: projectId, organizer_id: outsider.id, message: "Je peux organiser cet événement de A à Z." };
    expect((await outsider.db.from("organizer_proposals").insert(row)).error).not.toBeNull();
    await staff.db.rpc("admin_update_user", { p_user: outsider.id, p_verified_organizer: true });
    const { data, error } = await outsider.db.from("organizer_proposals").insert(row).select("id").single();
    expect(error).toBeNull();
    expect((await owner.db.rpc("respond_proposal", { p_proposal: data!.id, p_accept: true })).error).toBeNull();
    const { data: ev } = await owner.db.from("event_details").select("stage").eq("project_id", projectId).single();
    expect(ev?.stage).toBe("preparing");
    const { data: m } = await outsider.db.from("project_members").select("role").eq("project_id", projectId).eq("user_id", outsider.id).single();
    expect(m?.role).toBe("admin");
  });
});

describe("rate limiting", () => {
  it("limits comment bursts at the database level", async () => {
    let lastError = null;
    for (let i = 0; i < 31; i++) {
      const { error } = await helper.db.from("comments").insert({ project_id: projectId, author_id: helper.id, body: `Commentaire ${i}` });
      lastError = error;
    }
    expect(lastError?.message).toContain("VENTURE_RATE_LIMITED");
  });
});

describe("AI quota", () => {
  it("reflects the plan's monthly credits and only server-side writes usage", async () => {
    const { data } = await helper.db.rpc("ai_quota");
    expect(data?.[0]).toMatchObject({ plan: "free", monthly_credits: 20, used: 0, remaining: 20 });
    const { error } = await helper.db.from("ai_usage").insert({ user_id: helper.id, feature: "roadmap", credits: -100 } as never);
    expect(error).not.toBeNull();
    const { data: other } = await helper.db.rpc("ai_quota", { p_user: owner.id });
    expect(other).toEqual([]);
  });
});
