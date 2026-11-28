// Envoi d'email depuis les fonctions Edge : Brevo en production,
// table outbox en local (MAIL_MODE=outbox).
// Mini-client REST (PostgREST) avec la clé service_role : aucune dépendance externe.
type Res<T> = { data: T | null; error: { message: string } | null };

class Admin {
  private base = `${Deno.env.get("SUPABASE_URL")}/rest/v1`;
  private headers = {
    apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    "content-type": "application/json",
  };
  private async call<T>(path: string, init: RequestInit, single = false): Promise<Res<T>> {
    const r = await fetch(this.base + path, { ...init, headers: { ...this.headers, ...(init.headers ?? {}) } });
    const text = await r.text();
    if (!r.ok) return { data: null, error: { message: `${r.status} ${text.slice(0, 200)}` } };
    const body = text ? JSON.parse(text) : null;
    return { data: (single && Array.isArray(body) ? body[0] ?? null : body) as T, error: null };
  }
  rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    return this.call<T>(`/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  }
  findOne<T>(table: string, column: string, value: string, select = "*") {
    return this.call<T>(`/${table}?select=${select}&${column}=eq.${encodeURIComponent(value)}&limit=1`, { method: "GET" }, true);
  }
  insert<T>(table: string, row: Record<string, unknown>) {
    return this.call<T>(`/${table}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } }, true);
  }
  update(table: string, column: string, value: string, values: Record<string, unknown>) {
    return this.call(`/${table}?${column}=eq.${encodeURIComponent(value)}`, { method: "PATCH", body: JSON.stringify(values), headers: { Prefer: "return=minimal" } });
  }
}

export const admin = () => new Admin();

export async function sendMail(to: string, subject: string, html: string, text: string): Promise<void> {
  const mode = (Deno.env.get("MAIL_MODE") ?? "brevo").toLowerCase();
  if (mode === "outbox") {
    const { error } = await admin().insert("outbox", { to_email: to, subject, html });
    if (error) throw new Error(error.message);
    return;
  }
  const key = Deno.env.get("BREVO_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) throw new Error("BREVO_API_KEY / MAIL_FROM manquants");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { email: from, name: Deno.env.get("MAIL_FROM_NAME") ?? "ChantierAlerte" }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function layout(title: string, inner: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px"><tr><td style="padding:22px">
<p style="margin:0 0 14px"><span style="font-size:18px;font-weight:bold;color:#c2410c">Chantier</span><span style="font-size:18px;font-weight:bold;color:#111827">Alerte</span></p>
${inner}
<p style="margin:22px 0 0;font-size:12px;color:#6b7280">Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet email : aucune alerte ne vous sera envoyée.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export const button = (href: string, label: string) =>
  `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 18px;border-radius:6px">${esc(label)}</a></p>`;
