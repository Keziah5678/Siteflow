import "server-only";

/** Server configuration, read from the environment only. Nothing here reaches the browser. */
export const env = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get appUrl() { return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""); },
  get encryptionKey() { return process.env.ENCRYPTION_KEY ?? ""; },
  get cronSecret() { return process.env.CRON_SECRET ?? ""; },
  get adminEmails() { return (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean); },
  get platformSmtpUrl() { return process.env.PLATFORM_SMTP_URL ?? ""; },
  get platformFrom() { return process.env.PLATFORM_EMAIL_FROM ?? "RelancePro <no-reply@relancepro.fr>"; },
  get supportEmail() { return process.env.SUPPORT_EMAIL ?? ""; },
  get aiProvider() { return (process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.OPENAI_API_KEY ? "openai" : "none")) as "anthropic" | "openai" | "none"; },
  get anthropicKey() { return process.env.ANTHROPIC_API_KEY ?? ""; },
  get anthropicModel() { return process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"; },
  get openaiKey() { return process.env.OPENAI_API_KEY ?? ""; },
  get openaiModel() { return process.env.OPENAI_MODEL ?? "gpt-4o-mini"; },
  get stripeSecret() { return process.env.STRIPE_SECRET_KEY ?? ""; },
  get stripeWebhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET ?? ""; },
  get stripePrices() {
    return { starter: process.env.STRIPE_PRICE_STARTER ?? "", pro: process.env.STRIPE_PRICE_PRO ?? "", business: process.env.STRIPE_PRICE_BUSINESS ?? "" };
  },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID ?? ""; },
  get googleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ""; },
  get microsoftClientId() { return process.env.MICROSOFT_CLIENT_ID ?? ""; },
  get microsoftClientSecret() { return process.env.MICROSOFT_CLIENT_SECRET ?? ""; },
  /** Global kill switch for every automatic send, whatever the tenants configured. */
  get automationDisabled() { return process.env.AUTOMATION_DISABLED === "true"; },
  /** Dev-only tools (local outbox viewer). Never on in production unless forced. */
  get devTools() { return process.env.NODE_ENV !== "production" || process.env.RP_DEV_TOOLS === "true"; },
  get isProduction() { return process.env.NODE_ENV === "production"; }
};
