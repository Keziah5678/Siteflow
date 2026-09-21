import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ automationId: string }> },
) {
  const { automationId } = await params;
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const { data, error } = await supabase
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
  const { error } = await supabase.from("automations").delete().eq("id", automationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
