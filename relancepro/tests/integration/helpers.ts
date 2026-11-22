import { SMTPServer } from "smtp-server";
import { system } from "@/lib/db";
import { signUp } from "@/lib/auth/service";
import { loadContext } from "@/lib/app/context";

let n = 0;
export async function newCompany(label: string) {
  n++;
  const email = `${label}-${n}-${Date.now()}@test-entreprise.fr`;
  const { userId, orgId } = await signUp({ name: `Gérant ${label}`, email, password: "motdepasse-solide-42", company: `Entreprise ${label}`, sector: "garage", acceptTerms: true }, { ip: `10.0.${n}.1` });
  await system()`update rp.users set email_verified_at = now() where id = ${userId}`;
  // Tests run at any hour and day: no quiet hours, weekends allowed.
  await system()`update rp.organizations set settings = settings || '{"quietHours":{"start":0,"end":0},"allowWeekends":true}'::jsonb where id = ${orgId}`;
  const ctx = (await loadContext(userId, orgId))!;
  return { userId, orgId, email, ctx, reload: async () => (await loadContext(userId, orgId))! };
}

export type Captured = { from: string; to: string[]; raw: string };

/** A real SMTP server on localhost: what RelancePro sends is captured as raw MIME. */
export async function startSmtp(): Promise<{ port: number; mails: Captured[]; close: () => Promise<void> }> {
  const mails: Captured[] = [];
  const server = new SMTPServer({
    secure: false, disabledCommands: ["STARTTLS"], authOptional: false, logger: false,
    onAuth(auth, _s, cb) { if (auth.username === "relance" && auth.password === "secret") cb(null, { user: auth.username }); else cb(new Error("Invalid login")); },
    onData(stream, session, cb) {
      let raw = "";
      stream.on("data", c => (raw += c.toString()));
      stream.on("end", () => { mails.push({ from: String(session.envelope.mailFrom && session.envelope.mailFrom.address), to: session.envelope.rcptTo.map(r => r.address), raw }); cb(); });
    }
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.server.address() as { port: number }).port;
  return { port, mails, close: () => new Promise(r => server.close(() => r())) };
}
