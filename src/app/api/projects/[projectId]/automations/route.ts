import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isProjectMember } from "@/lib/supabase/authorize";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  trigger: z.string().trim().min(1).max(60),
  action: z.string().trim().min(1).max(60),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!(await isProjectMember(user.id, projectId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 422 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("automations")
    .insert({ project_id: projectId, ...parsed.data })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ automation: data });
}
