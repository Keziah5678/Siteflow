import "server-only";
import { system, withTenant } from "../db";
import { layout, queuePlatformEmail } from "../mail/platform";
import { randomToken, sha256 } from "../server/crypto";
import { env } from "../server/env";
import { AppError, requireRole, type OrgContext } from "./context";

export async function listTeam(ctx: OrgContext) {
  return withTenant(ctx.userId, async tx => ({
    members: await tx`select m.user_id, m.role, m.created_at, u.name, u.email from rp.memberships m join rp.users u on u.id = m.user_id where m.org_id = ${ctx.orgId} order by m.created_at`,
    invitations: ctx.role === "member" ? [] : await tx`select id, email, role, expires_at, accepted_at from rp.invitations where org_id = ${ctx.orgId} and accepted_at is null and expires_at > now() order by created_at desc`
  }));
}

export async function invite(ctx: OrgContext, emailRaw: string, role: "admin" | "member", inviterName: string) {
  requireRole(ctx, "admin");
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError("Adresse e-mail invalide.");
  const token = randomToken();
  await withTenant(ctx.userId, async tx => {
    const [n] = await tx`select (select count(*)::int from rp.memberships where org_id = ${ctx.orgId}) + (select count(*)::int from rp.invitations where org_id = ${ctx.orgId} and accepted_at is null and expires_at > now()) as n`;
    if (Number(n.n) >= ctx.limits.users) throw new AppError(`Votre formule permet ${ctx.limits.users} utilisateur(s).`, "limit");
    const dup = await tx`select 1 from rp.memberships m join rp.users u on u.id = m.user_id where m.org_id = ${ctx.orgId} and u.email = ${email}`;
    if (dup.length) throw new AppError("Cette personne fait déjà partie de l'équipe.", "conflict");
    await tx`insert into rp.invitations (org_id, email, role, token_hash, invited_by) values (${ctx.orgId}, ${email}, ${role}, ${sha256(token)}, ${ctx.userId})`;
  });
  const url = `${env.appUrl}/invite?token=${token}`;
  await queuePlatformEmail(system(), {
    to: email, kind: "invite", subject: `${inviterName} vous invite sur RelancePro`,
    text: `${inviterName} vous invite à rejoindre l'espace ${ctx.org.name} sur RelancePro.\n\nAccepter l'invitation : ${url}\n\nCe lien expire dans 7 jours.`,
    html: layout(`Rejoignez ${ctx.org.name} sur RelancePro`, [`${inviterName} vous invite à rejoindre l'espace ${ctx.org.name}.`, "Ce lien expire dans 7 jours."], { label: "Accepter l'invitation", url })
  });
}

/** Accepts an invitation for the signed-in user; the invitation must match their verified address. */
export async function acceptInvitation(userId: string, userEmail: string, token: string): Promise<string> {
  return system().begin(async tx => {
    const [inv] = await tx`select * from rp.invitations where token_hash = ${sha256(token)} and accepted_at is null and expires_at > now() for update`;
    if (!inv) throw new AppError("Invitation invalide ou expirée.", "not_found");
    if (inv.email !== userEmail.toLowerCase()) throw new AppError("Cette invitation a été envoyée à une autre adresse.", "forbidden");
    await tx`insert into rp.memberships (org_id, user_id, role) values (${inv.orgId}, ${userId}, ${inv.role}) on conflict do nothing`;
    await tx`update rp.invitations set accepted_at = now() where id = ${inv.id}`;
    await tx`insert into rp.audit_log (org_id, user_id, action) values (${inv.orgId}, ${userId}, 'invitation_accepted')`;
    return inv.orgId as string;
  });
}

export async function removeMember(ctx: OrgContext, userId: string) {
  if (userId !== ctx.userId) requireRole(ctx, "admin");
  const r = await withTenant(ctx.userId, tx => tx`delete from rp.memberships where org_id = ${ctx.orgId} and user_id = ${userId} and role <> 'owner' returning user_id`);
  if (!r.length) throw new AppError("Impossible de retirer ce membre.", "forbidden");
}
