import { describe, expect, it } from "vitest";
import { isAdult, passwordSchema, projectSchema, signupSchema } from "@/lib/validation";
import { safeRedirectPath, progressFromMilestones, splitTags } from "@/lib/utils";
import { toUserMessage } from "@/lib/errors";
import { can } from "@/lib/constants";

describe("age gate", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  it("accepts exactly 18 years old", () => expect(isAdult("2008-11-25", now)).toBe(true));
  it("rejects one day short of 18", () => expect(isAdult("2008-11-26", now)).toBe(false));
  it("rejects invalid dates", () => expect(isAdult("not-a-date", now)).toBe(false));
});

describe("signupSchema", () => {
  const ok = { display_name: "Léa", email: "LEA@Example.com ", password: "Motdepasse1", birthdate: "1995-01-01", terms: "on" };
  it("normalises email", () => expect(signupSchema.parse(ok).email).toBe("lea@example.com"));
  it("rejects minors", () => expect(signupSchema.safeParse({ ...ok, birthdate: "2015-01-01" }).success).toBe(false));
  it("requires accepting terms", () => expect(signupSchema.safeParse({ ...ok, terms: undefined }).success).toBe(false));
  it("flags the honeypot", () => expect(signupSchema.safeParse({ ...ok, website: "spam" }).success).toBe(false));
});

describe("passwordSchema", () => {
  it.each(["short1A", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"])("rejects %s", (p) => expect(passwordSchema.safeParse(p).success).toBe(false));
  it("accepts a strong password", () => expect(passwordSchema.safeParse("Venture2026ok").success).toBe(true));
});

describe("projectSchema", () => {
  it("parses tags from comma strings and coerces numbers", () => {
    const r = projectSchema.parse({ title: "Mon projet", description: "Une description suffisante", category: "event", skills_needed: "DJ, Photo", resources_needed: [], interest_goal: "200", budget_estimate_eur: "" });
    expect(r.skills_needed).toEqual(["DJ", "Photo"]);
    expect(r.interest_goal).toBe(200);
    expect(r.budget_estimate_eur).toBeNull();
  });
  it("rejects an invalid category and too-short title", () => {
    expect(projectSchema.safeParse({ title: "abc", description: "Une description suffisante", category: "x", skills_needed: [], resources_needed: [] }).success).toBe(false);
  });
  it("rejects non-http cover URLs (javascript:)", () => {
    expect(projectSchema.safeParse({ title: "Mon projet", description: "Une description suffisante", category: "business", skills_needed: [], resources_needed: [], cover_url: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("utils", () => {
  it("blocks open redirects", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("/projects/1")).toBe("/projects/1");
  });
  it("computes progress from completed steps only", () => {
    expect(progressFromMilestones(0, 0)).toBe(0);
    expect(progressFromMilestones(1, 3)).toBe(33);
    expect(progressFromMilestones(5, 3)).toBe(100);
  });
  it("splits tags", () => expect(splitTags(" a, b ,\n c,,")).toEqual(["a", "b", "c"]));
});

describe("error mapping", () => {
  it("maps DB codes to French messages", () => {
    expect(toUserMessage({ message: "VENTURE_RATE_LIMITED" })).toMatch(/Trop d'actions/);
    expect(toUserMessage({ message: "new row violates row-level security policy" })).toMatch(/autorisation/);
    expect(toUserMessage({ message: "Invalid login credentials" })).toMatch(/incorrect/);
  });
});

describe("admin permissions", () => {
  it("separates roles", () => {
    expect(can("moderator", "reports")).toBe(true);
    expect(can("moderator", "plans")).toBe(false);
    expect(can("admin", "plans")).toBe(true);
    expect(can("admin", "roles")).toBe(false);
    expect(can("superadmin", "roles")).toBe(true);
    expect(can("user", "reports")).toBe(false);
  });
});

describe("optional numbers", () => {
  const base = { title: "Mon projet", description: "Une description suffisante", category: "event", skills_needed: [], resources_needed: [] };
  it("treats empty and null as null, not 0", () => {
    expect(projectSchema.parse({ ...base, price_min_eur: "", capacity: null }).price_min_eur).toBeNull();
    expect(projectSchema.parse({ ...base, capacity: null }).capacity).toBeNull();
  });
  it("keeps a real zero", () => expect(projectSchema.parse({ ...base, price_min_eur: 0 }).price_min_eur).toBe(0));
  it("rejects out-of-range values instead of silently dropping them", () => {
    expect(projectSchema.safeParse({ ...base, interest_goal: -5 }).success).toBe(false);
  });
});
