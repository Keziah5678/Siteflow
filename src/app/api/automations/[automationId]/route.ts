import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isProjectResourceMember } from "@/lib/supabase/authorize";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> },
) {
  const { automationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!(await isProjectResourceMember(user.id, "automations", automationId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("automations")
    .update({ enabled: Boolean(body.enabled) })
    .eq("id", automationId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ automation: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ automationId: string }> },
) {
  const { automationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!(await isProjectResourceMember(user.id, "automations", automationId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from("automations").delete().eq("id", automationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
