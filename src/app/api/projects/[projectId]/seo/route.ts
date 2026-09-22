import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isProjectMember } from "@/lib/supabase/authorize";

const bodySchema = z.object({
  global_seo: z
    .object({
      site_title: z.string().max(70).optional(),
      site_description: z.string().max(180).optional(),
    })
    .optional(),
  status: z.enum(["draft", "published"]).optional(),
});

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
  if (!(await isProjectMember(user.id, projectId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 422 });
  }

  const db = createServiceRoleClient();
  const { data: website, error } = await db
    .from("websites")
    .update(parsed.data)
    .eq("project_id", projectId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ website });
}
