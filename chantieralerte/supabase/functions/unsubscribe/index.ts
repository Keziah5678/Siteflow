// Désinscription en un clic.
//   GET  ?t=<jeton>  → désinscrit puis redirige vers la page de confirmation du site
//   POST ?t=<jeton>  → « List-Unsubscribe-Post: One-Click » (Gmail, Outlook…)
import { admin } from "../_shared/mail.ts";

const SITE = (Deno.env.get("SITE_URL") ?? "http://localhost:8080").replace(/\/$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(t)) return new Response("Lien invalide", { status: 400 });
  const { error } = await admin().rpc("unsubscribe", { p_token: t });
  if (error) return new Response("Erreur, réessayez", { status: 500 });
  if (req.method === "POST") return new Response("Désinscription effectuée", { status: 200 });
  return Response.redirect(`${SITE}/desinscription.html?t=${t}&ok=1`, 303);
});
