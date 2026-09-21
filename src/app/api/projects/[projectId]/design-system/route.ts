import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { designSystemPlanSchema } from "@/lib/ai/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = designSystemPlanSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("design_systems")
    .update(parsed.data)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ designSystem: data });
}
