import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Globe2, MapPin, Megaphone } from "lucide-react";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { OPPORTUNITY_KIND_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Page } from "@/components/layout/page";
import { Avatar, Badge, Card, Notice, Tag } from "@/components/ui/primitives";
import { RespondOpportunity } from "@/components/business/respond-opportunity";
import { ReportButton } from "@/components/report-button";

export const metadata: Metadata = { title: "Opportunité" };

export default async function OpportunityPage(props: PageProps<"/opportunities/[id]">) {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user, supabase } = await getViewer();
  const { data: o } = await supabase.from("opportunities").select("*, company:profiles!opportunities_company_id_fkey(id, username, display_name, company_name, avatar_url)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const company = o.company as { id: string; username: string; display_name: string; company_name: string | null; avatar_url: string | null } | null;
  const isOwner = user?.id === o.company_id;
  let responded = false;
  if (user && !isOwner) {
    const { data } = await supabase.from("opportunity_responses").select("id").eq("opportunity_id", id).eq("user_id", user.id).maybeSingle();
    responded = !!data;
  }
  return (
    <Page>
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary"><Briefcase /> {OPPORTUNITY_KIND_LABEL[o.kind]}</Badge>
        {o.is_sponsored && <Badge tone="outline"><Megaphone /> Sponsorisé</Badge>}
        {!o.is_open && <Badge tone="danger">Clôturée</Badge>}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{o.title}</h1>
      {company && (
        <Link href={`/u/${company.username}`} className="mt-3 flex items-center gap-2.5">
          <Avatar name={company.company_name ?? company.display_name} src={company.avatar_url} size={32} />
          <span className="text-sm font-medium">{company.company_name ?? company.display_name}</span>
          <span className="text-[12px] text-subtle">· {formatDate(o.created_at)}</span>
        </Link>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-muted">
        {(o.city || o.is_remote) && <span className="inline-flex items-center gap-1.5">{o.is_remote ? <Globe2 className="size-3.5" /> : <MapPin className="size-3.5" />}{[o.city, o.is_remote ? "À distance" : null].filter(Boolean).join(" · ")}</span>}
        {o.compensation && <span>{o.compensation}</span>}
      </div>
      <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed">{o.description}</p>
      {o.skills.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5">{o.skills.map((s) => <Tag key={s}>{s}</Tag>)}</div>}
      <Card className="mt-8 p-5">
        {isOwner ? (
          <Notice>C'est ton opportunité. Les réponses sont visibles dans ton <Link href="/business?tab=responses" className="text-primary-2 hover:underline">espace pro</Link>.</Notice>
        ) : !o.is_open ? (
          <p className="text-sm text-muted">Cette opportunité n'accepte plus de réponses.</p>
        ) : (
          <RespondOpportunity opportunityId={id} signedIn={!!user} responded={responded} />
        )}
      </Card>
      {user && !isOwner && <div className="mt-6"><ReportButton targetType="opportunity" targetId={id} label="Signaler cette opportunité" /></div>}
    </Page>
  );
}
