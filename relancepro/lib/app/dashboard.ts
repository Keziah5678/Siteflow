import "server-only";
import { withTenant } from "../db";
import { isForgotten } from "../ai/engine";
import { settingsWithDefaults, type OrgContext } from "./context";

/**
 * Dashboard figures. Every number is a count over the company's own rows,
 * so it can be traced back to the prospects behind it.
 */
export async function dashboard(ctx: OrgContext, days: number) {
  const period = Math.max(1, Math.min(365, Math.round(days)));
  const since = new Date(Date.now() - period * 86400_000).toISOString();
  const after = settingsWithDefaults(ctx.org.settings).followUpAfterDays;
  return withTenant(ctx.userId, async tx => {
    const [c] = await tx`
      select
        (select count(*)::int from rp.prospects where org_id = ${ctx.orgId}) as total,
        (select count(*)::int from rp.prospects where org_id = ${ctx.orgId} and created_at >= ${since}::timestamptz) as new_in_period,
        (select count(*)::int from rp.quotes where org_id = ${ctx.orgId} and status = 'sent') as quotes_pending,
        (select count(*)::int from rp.enrollments where org_id = ${ctx.orgId} and status = 'active') as active_sequences,
        (select count(*)::int from rp.messages where org_id = ${ctx.orgId} and status in ('draft','needs_review')) as to_review,
        (select count(*)::int from rp.messages where org_id = ${ctx.orgId} and status = 'approved') as scheduled,
        (select count(*)::int from rp.messages where org_id = ${ctx.orgId} and status = 'sent' and sent_at >= ${since}::timestamptz) as sent,
        (select count(*)::int from rp.interactions i where i.org_id = ${ctx.orgId} and i.direction = 'inbound' and i.channel <> 'system' and i.occurred_at >= ${since}::timestamptz
            and exists (select 1 from rp.interactions o where o.prospect_id = i.prospect_id and o.direction = 'outbound' and o.occurred_at < i.occurred_at)) as replies,
        (select count(*)::int from rp.prospects where org_id = ${ctx.orgId} and status = 'meeting') as meetings,
        (select count(*)::int from rp.prospects p where p.org_id = ${ctx.orgId} and p.status in ('meeting','won')
            and exists (select 1 from rp.messages m where m.prospect_id = p.id and m.status = 'sent')) as recovered,
        (select coalesce(sum(won_value_cents), 0)::bigint from rp.prospects where org_id = ${ctx.orgId} and status = 'won' and updated_at >= ${since}::timestamptz) as won_cents,
        (select coalesce(sum(won_value_cents), 0)::bigint from rp.prospects p where p.org_id = ${ctx.orgId} and p.status = 'won' and updated_at >= ${since}::timestamptz
            and exists (select 1 from rp.messages m where m.prospect_id = p.id and m.status = 'sent')) as recovered_cents,
        (select count(*)::int from rp.interactions where org_id = ${ctx.orgId} and ai_intent is not null and occurred_at >= ${since}::timestamptz) as ai_analyses,
        (select count(*)::int from rp.messages where org_id = ${ctx.orgId} and created_at >= ${since}::timestamptz) as ai_drafts,
        (select count(*)::int from rp.ai_usage where org_id = ${ctx.orgId} and created_at >= date_trunc('month', now())) as ai_actions_month`;
    const open = await tx`select status, last_inbound_at, last_outbound_at, created_at from rp.prospects where org_id = ${ctx.orgId} and status not in ('won','lost','opposed','meeting')`;
    const now = new Date();
    const forgotten = open.filter(r => isForgotten({ status: r.status as string, lastInboundAt: r.lastInboundAt as Date | null, lastOutboundAt: r.lastOutboundAt as Date | null, createdAt: r.createdAt as Date }, after, now)).length;
    const byStatus = await tx`select status, count(*)::int as n from rp.prospects where org_id = ${ctx.orgId} group by status`;
    const series = await tx`
      select d::date as day,
        (select count(*)::int from rp.prospects where org_id = ${ctx.orgId} and created_at::date = d::date) as prospects,
        (select count(*)::int from rp.messages where org_id = ${ctx.orgId} and status = 'sent' and sent_at::date = d::date) as sent
      from generate_series((now() - (${period - 1} * interval '1 day'))::date, now()::date, interval '1 day') d order by d`;
    const priorities = await tx`select id, first_name, last_name, company, status, ai_score, ai_urgency, ai_summary from rp.prospects
      where org_id = ${ctx.orgId} and status in ('new','to_contact','to_follow_up','waiting') order by ai_urgency desc, ai_score desc nulls last limit 6`;
    return {
      period,
      counts: { ...c, forgotten, wonCents: Number(c.wonCents), recoveredCents: Number(c.recoveredCents) } as Record<string, number>,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status as string, Number(r.n)])),
      series: series.map(r => ({ day: (r.day as Date).toISOString().slice(0, 10), prospects: Number(r.prospects), sent: Number(r.sent) })),
      priorities
    };
  });
}
