// POST /functions/v1/subscribe  { email, trades: string[], departments: string[], website?: "" }
// Inscription avec double opt-in. Réponse identique que l'email existe ou non.
import { admin, button, esc, layout, sendMail } from "../_shared/mail.ts";

const SITE = (Deno.env.get("SITE_URL") ?? "http://localhost:8080").replace(/\/$/, "");
const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const cors = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "content-type, authorization, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TRADE = /^[a-z][a-z-]{1,30}$/;
const DEPT = /^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/;
const OK = { ok: true, message: "C'est presque fini : cliquez sur le lien que nous venons de vous envoyer par email pour démarrer votre essai gratuit." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Requête invalide" });
  }
  // Champ piège : un humain ne le remplit jamais → on répond « ok » sans rien faire.
  if (typeof body.website === "string" && body.website.trim() !== "") return json(200, OK);

  const email = String(body.email ?? "").trim().toLowerCase();
  const trades = Array.isArray(body.trades) ? [...new Set(body.trades.map(String))] : [];
  const departments = Array.isArray(body.departments) ? [...new Set(body.departments.map((d) => String(d).toUpperCase()))] : [];
  if (!EMAIL.test(email) || email.length > 254) return json(400, { error: "Adresse email invalide.", field: "email" });
  if (trades.length < 1 || trades.length > 15 || !trades.every((t) => TRADE.test(t))) return json(400, { error: trades.length ? "Métier inconnu." : "Choisissez au moins un métier.", field: "trades" });
  if (departments.length < 1 || departments.length > 101 || !departments.every((d) => DEPT.test(d))) return json(400, { error: departments.length ? "Département inconnu." : "Choisissez au moins un département.", field: "departments" });

  const db = admin();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const [{ data: okIp }, { data: okMail }] = await Promise.all([
    db.rpc("check_rate_limit", { p_key: `sub:ip:${ip}`, p_max: 10, p_window_seconds: 3600 }),
    db.rpc("check_rate_limit", { p_key: `sub:mail:${email}`, p_max: 3, p_window_seconds: 3600 }),
  ]);
  if (okIp === false || okMail === false) return json(429, { error: "Trop de tentatives. Réessayez dans une heure." });

  const { data: existing } = await db.findOne<{ id: string; token: string; status: string }>("subscribers", "email", email, "id,token,status");
  try {
    if (!existing) {
      const { data: created, error } = await db.insert<{ token: string }>("subscribers", { email, trades, departments, status: "pending" });
      if (error || !created) throw new Error(error?.message ?? "insert");
      const link = `${SITE}/confirmer.html?t=${created.token}`;
      await sendMail(email, "Confirmez votre inscription à ChantierAlerte",
        layout("Confirmez votre inscription", `<h1 style="font-size:21px;margin:0 0 10px">Plus qu'un clic</h1><p style="font-size:15px;line-height:22px">Confirmez votre adresse pour recevoir chaque matin à 7 h les nouveaux appels d'offres publics de votre métier. Votre essai gratuit de 14 jours démarre à la confirmation, sans carte bancaire.</p>${button(link, "Confirmer et démarrer l'essai")}<p style="font-size:13px;color:#6b7280">Lien : ${esc(link)}</p>`),
        `Confirmez votre inscription à ChantierAlerte : ${link}`);
      await db.update("subscribers", "token", created.token, { confirmation_sent_at: new Date().toISOString() });
    } else {
      // Déjà inscrit : on ne modifie RIEN (quelqu'un d'autre a pu saisir cette adresse).
      const pending = existing.status === "pending";
      const link = pending ? `${SITE}/confirmer.html?t=${existing.token}` : `${SITE}/preferences.html?t=${existing.token}`;
      await sendMail(email, pending ? "Confirmez votre inscription à ChantierAlerte" : "Votre compte ChantierAlerte",
        layout("ChantierAlerte", pending
          ? `<h1 style="font-size:21px;margin:0 0 10px">Plus qu'un clic</h1><p style="font-size:15px;line-height:22px">Confirmez votre adresse pour démarrer votre essai gratuit de 14 jours.</p>${button(link, "Confirmer et démarrer l'essai")}`
          : `<h1 style="font-size:21px;margin:0 0 10px">Vous êtes déjà inscrit</h1><p style="font-size:15px;line-height:22px">Une demande d'inscription vient d'être faite avec votre adresse. Pour modifier vos métiers ou départements, ou réactiver vos alertes, utilisez votre espace :</p>${button(link, "Gérer mes alertes")}`),
        `${pending ? "Confirmez votre inscription" : "Gérer mes alertes"} : ${link}`);
    }
  } catch (e) {
    console.error("subscribe", e);
    return json(502, { error: "L'envoi de l'email de confirmation a échoué. Réessayez dans quelques minutes." });
  }
  return json(200, OK);
});
