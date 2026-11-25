import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { admin, cleanup, createUser, type TestUser } from "./helpers";

// ---------------------------------------------------------------------------
// Stripe webhook: real route handler, real DB, locally signed events
// ---------------------------------------------------------------------------
process.env.STRIPE_SECRET_KEY = "sk_test_venture_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_venture_test_secret";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------------------------------------------------------------------
// AI provider mock: returns one real candidate id and one invented id.
// ---------------------------------------------------------------------------
const generate = vi.fn();
vi.mock("@/lib/ai/provider", async (orig) => {
  const mod = await orig<typeof import("@/lib/ai/provider")>();
  return { ...mod, getProvider: async () => ({ name: "mock", generate }) };
});

let buyer: TestUser, owner: TestUser, cand: TestUser;
let projectId: string;

beforeAll(async () => {
  buyer = await createUser("buyer");
  owner = await createUser("aiowner");
  cand = await createUser("aicand");
  await cand.db.from("profiles").update({ skills: ["Design", "Couture"], interests: ["Mode"], is_discoverable: true }).eq("id", cand.id);
  const { data } = await owner.db.from("projects").insert({ owner_id: owner.id, title: "Marque de vêtements test", description: "Créer une marque de mode upcyclée ensemble.", category: "creation", skills_needed: ["Design", "Marketing"] }).select("id").single();
  projectId = data!.id;
});
afterAll(async () => cleanup([buyer, owner, cand]));

function signed(event: object) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } });
}

describe("Stripe webhook", () => {
  const evt = () => ({
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: `cs_test_${Math.random().toString(36).slice(2)}`, object: "checkout.session", mode: "subscription", client_reference_id: buyer.id, metadata: { user_id: buyer.id, plan: "plus" }, subscription: "sub_test_123", amount_total: 999, currency: "eur", payment_status: "paid" } },
  });

  it("rejects missing or forged signatures", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const noSig = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(noSig.status).toBe(400);
    const forged = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: JSON.stringify(evt()), headers: { "stripe-signature": "t=1,v1=deadbeef" } }));
    expect(forged.status).toBe(400);
    const { data } = await admin.from("profiles").select("plan").eq("id", buyer.id).single();
    expect(data?.plan).toBe("free");
  });

  it("activates the plan once, and ignores replays of the same event (no duplicate payment)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const e = evt();
    const r1 = await POST(signed(e));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toMatchObject({ result: "handled" });
    const r2 = await POST(signed(e));
    expect(await r2.json()).toMatchObject({ duplicate: true });
    const { data: p } = await admin.from("profiles").select("plan").eq("id", buyer.id).single();
    expect(p?.plan).toBe("plus");
    const { data: pays } = await admin.from("payments").select("id").eq("user_id", buyer.id);
    expect(pays).toHaveLength(1);
    const { data: q } = await buyer.db.rpc("ai_quota");
    expect(q?.[0]?.monthly_credits).toBe(300);
  });

  it("activates the plan from customer.subscription.created (subscriptions created outside Checkout)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    await admin.from("profiles").update({ plan: "free" }).eq("id", buyer.id);
    const r = await POST(signed({ id: `evt_created_${Date.now()}`, object: "event", type: "customer.subscription.created", data: { object: { id: "sub_test_123", object: "subscription", status: "active", metadata: { user_id: buyer.id, plan: "plus" }, items: { data: [{ current_period_end: 1893456000 }] } } } }));
    expect(r.status).toBe(200);
    const { data } = await admin.from("profiles").select("plan").eq("id", buyer.id).single();
    expect(data?.plan).toBe("plus");
    const { data: sub } = await admin.from("subscriptions").select("current_period_end").eq("user_id", buyer.id).single();
    expect(sub?.current_period_end).toContain("2030-01-01");
  });

  it("downgrades to free when the subscription is deleted", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const r = await POST(signed({ id: `evt_del_${Date.now()}`, object: "event", type: "customer.subscription.deleted", data: { object: { id: "sub_test_123", object: "subscription", status: "canceled", metadata: { user_id: buyer.id, plan: "plus" }, items: { data: [] } } } }));
    expect(r.status).toBe(200);
    const { data } = await admin.from("profiles").select("plan").eq("id", buyer.id).single();
    expect(data?.plan).toBe("free");
  });
});

describe("VENTURE AI service", () => {
  it("drops invented user ids, records usage and decrements the quota", async () => {
    const { runAIFeature } = await import("@/lib/ai/service");
    generate.mockResolvedValueOnce({
      data: {
        recommendations: [
          { user_id: cand.id, role_for_project: "Designer", explanation: "Compétences en design et couture." },
          { user_id: "00000000-0000-4000-8000-00000000dead", role_for_project: "Inventé", explanation: "N'existe pas." },
        ],
        uncovered_needs: ["Marketing"],
      },
      usage: { inputTokens: 1200, outputTokens: 300, provider: "mock", model: "mock-model" },
    });
    const res = await runAIFeature(owner.db, owner.id, "recommend_people", { projectId });
    const data = res.data as { recommendations: { user_id: string }[]; profiles: { id: string }[] };
    expect(data.recommendations.map((r) => r.user_id)).toEqual([cand.id]);
    expect(data.profiles.map((p) => p.id)).toEqual([cand.id]);
    expect(res.remaining).toBe(18);
    const { data: usage } = await owner.db.from("ai_usage").select("credits, input_tokens");
    expect(usage).toEqual([{ credits: 2, input_tokens: 1200 }]);
    // The prompt only contains real, discoverable candidates
    const prompt = generate.mock.calls[0]![0].user as string;
    expect(prompt).toContain(cand.id);
    expect(prompt).toContain("<donnees_utilisateur");
  });

  it("refuses project features to non-members and recommend_people to non-managers", async () => {
    const { runAIFeature } = await import("@/lib/ai/service");
    const before = generate.mock.calls.length;
    await expect(runAIFeature(cand.db, cand.id, "roadmap", { projectId })).rejects.toThrow(/membres/);
    expect(generate.mock.calls.length).toBe(before); // provider never called
  });

  it("enforces the monthly quota before calling the provider", async () => {
    const { runAIFeature } = await import("@/lib/ai/service");
    await admin.from("ai_usage").insert({ user_id: owner.id, feature: "business_plan", credits: 18 });
    const before = generate.mock.calls.length;
    await expect(runAIFeature(owner.db, owner.id, "business_plan", { projectId })).rejects.toThrow(/Crédits IA insuffisants/);
    expect(generate.mock.calls.length).toBe(before); // provider never called
  });

  it("validates idea length", async () => {
    const { runAIFeature } = await import("@/lib/ai/service");
    await expect(runAIFeature(cand.db, cand.id, "structure_idea", { idea: "court" })).rejects.toThrow(/10 à 2000/);
  });
});
