import Link from "next/link";
import { ArrowUpRight, Briefcase, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/queries";
import { CATEGORY_LABEL, OPPORTUNITY_KIND_LABEL } from "@/lib/constants";
import { daysAgoISO, formatNumber } from "@/lib/utils";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";

export async function RightRail() {
  const supabase = await createClient();
  const { showDemo } = await getAppSettings();
  const since = daysAgoISO(30);
  let trendingQ = supabase
    .from("projects")
    .select("id, title, category, interest_count, is_demo")
    .eq("moderation", "visible")
    .not("status", "in", "(completed,cancelled)")
    .gte("created_at", since)
    .order("interest_count", { ascending: false })
    .limit(5);
  if (!showDemo) trendingQ = trendingQ.eq("is_demo", false);
  const [{ data: trending }, { data: opps }] = await Promise.all([
    trendingQ,
    supabase.from("opportunities").select("id, title, kind, is_sponsored, company:profiles!opportunities_company_id_fkey(company_name, display_name)").eq("is_open", true).eq("moderation", "visible").order("created_at", { ascending: false }).limit(4),
  ]);

  return (
    <>
      <section>
        <SectionTitle>Tendances</SectionTitle>
        <Card className="divide-y divide-border">
          {(trending ?? []).length === 0 && <p className="p-4 text-sm text-muted">Aucun projet récent pour le moment.</p>}
          {(trending ?? []).map((p, i) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex gap-3 p-3.5 hover:bg-card-hover">
              <span className="w-4 pt-0.5 text-[13px] font-semibold text-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[14px] font-medium leading-snug">{p.title}</span>
                <span className="mt-1 flex items-center gap-2 text-[12px] text-subtle">
                  {CATEGORY_LABEL[p.category]} · <TrendingUp className="size-3" /> {formatNumber(p.interest_count)} intéressé{p.interest_count > 1 ? "s" : ""}
                  {p.is_demo && <span className="text-warning">· démo</span>}
                </span>
              </span>
            </Link>
          ))}
        </Card>
      </section>
      <section>
        <SectionTitle action={<Link href="/explore?u=opportunities" className="text-[12px] text-primary-2 hover:underline">Tout voir</Link>}>Opportunités</SectionTitle>
        <Card className="divide-y divide-border">
          {(opps ?? []).length === 0 && <p className="p-4 text-sm text-muted">Les entreprises publieront ici leurs missions et partenariats.</p>}
          {(opps ?? []).map((o) => {
            const company = o.company as { company_name: string | null; display_name: string } | null;
            return (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block p-3.5 hover:bg-card-hover">
                <span className="flex items-center gap-2 text-[12px] text-subtle">
                  <Briefcase className="size-3" /> {OPPORTUNITY_KIND_LABEL[o.kind]} · {company?.company_name ?? company?.display_name}
                  {o.is_sponsored && <Badge tone="outline">Sponsorisé</Badge>}
                </span>
                <span className="mt-1 line-clamp-2 text-[14px] font-medium">{o.title}</span>
              </Link>
            );
          })}
        </Card>
      </section>
      <Card className="v-glow p-4">
        <p className="text-sm font-medium">Une idée en tête ?</p>
        <p className="mt-1 text-[13px] text-muted">Décris-la en une phrase : VENTURE t'aide à la structurer et à trouver ton équipe.</p>
        <Link href="/create" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary-2 hover:underline">
          Publier un projet <ArrowUpRight className="size-3.5" />
        </Link>
      </Card>
      <p className="px-1 text-[12px] leading-relaxed text-subtle">
        <Link href="/pricing" className="hover:text-fg">Offres</Link> · <Link href="/legal" className="hover:text-fg">Confidentialité & conditions</Link> · VENTURE — Dream. Connect. Build.
      </p>
    </>
  );
}
