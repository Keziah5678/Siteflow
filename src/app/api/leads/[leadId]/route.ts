import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["nouveau", "contacte", "qualifie", "rendez-vous", "proposition", "gagne", "perdu"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 422 });
    }
    update.status = body.status;
  }

  if (typeof body.note === "string" && body.note.trim()) {
    const { data: current } = await supabase.from("leads").select("notes").eq("id", leadId).single();
    const notes = Array.isArray(current?.notes) ? current.notes : [];
    update.notes = [
      ...notes,
      { id: crypto.randomUUID(), body: body.note.trim(), created_at: new Date().toISOString() },
    ];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 422 });
  }

  const { data, error } = await supabase.from("leads").update(update).eq("id", leadId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ lead: data });
}
