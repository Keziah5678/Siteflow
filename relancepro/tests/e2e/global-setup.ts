import { SMTPServer } from "smtp-server";
import { writeFileSync, mkdirSync } from "node:fs";

/** A real SMTP server for the run: every e-mail RelancePro sends lands in test-results/mails.json. */
export default async function globalSetup() {
  mkdirSync("test-results", { recursive: true });
  const mails: Array<{ to: string[]; raw: string }> = [];
  writeFileSync("test-results/mails.json", "[]");
  const server = new SMTPServer({
    secure: false, disabledCommands: ["STARTTLS"], logger: false,
    onAuth(a, _s, cb) { if (a.username === "relance" && a.password === "secret") cb(null, { user: "relance" }); else cb(new Error("Invalid login")); },
    onData(stream, session, cb) {
      let raw = "";
      stream.on("data", c => (raw += c.toString()));
      stream.on("end", () => { mails.push({ to: session.envelope.rcptTo.map(r => r.address), raw }); writeFileSync("test-results/mails.json", JSON.stringify(mails)); cb(); });
    }
  });
  await new Promise<void>(r => server.listen(2526, "127.0.0.1", () => r()));
  return async () => { await new Promise<void>(r => server.close(() => r())); };
}
