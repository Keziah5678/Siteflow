import { NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { orchestrator } from "@/lib/ai/orchestrator";
import { isAIConfigured } from "@/lib/ai/client";
import type { BusinessProfile, FormField } from "@/lib/types";

// Public, unauthenticated endpoint. Leads have no anonymous RLS insert
// policy on purpose (see migration 0001) — this route validates that the
// form belongs to a project whose website is actually published before
// using the service-role client to insert, so a visitor can never write a
// lead into an arbitrary/unpublished project by guessing an id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const values = body?.values as Record<string, string> | undefined;
  if (!values || typeof values !== "object") {
    return NextResponse.json({ error: "Données du formulaire manquantes." }, { status: 422 });
  }

  const supabase = createServiceRoleClient();

  const { data: form } = await supabase.from("forms").select("*").eq("id", formId).maybeSingle();
  if (!form) return NextResponse.json({ error: "Formulaire introuvable." }, { status: 404 });

  const { data: website } = await supabase
    .from("websites")
    .select("id, status")
    .eq("project_id", form.project_id)
    .maybeSingle();
  if (!website || website.status !== "published") {
    return NextResponse.json({ error: "Ce site n'est pas publié." }, { status: 403 });
  }

  const fields = (form.fields ?? []) as FormField[];
  for (const field of fields) {
    if (field.required && !String(values[field.id] ?? "").trim()) {
      return NextResponse.json({ error: `Le champ "${field.label}" est requis.` }, { status: 422 });
    }
  }

  const findByType = (type: FormField["type"]) => fields.find((f) => f.type === type);
  const nameField = fields.find((f) => f.label.toLowerCase().includes("nom"));
  const messageField = fields.find((f) => f.type === "textarea");

  const leadRow = {
    project_id: form.project_id,
    form_id: form.id,
    name: nameField ? values[nameField.id] ?? null : null,
    email: (() => {
      const f = findByType("email");
      return f ? values[f.id] ?? null : null;
    })(),
    phone: (() => {
      const f = findByType("tel");
      return f ? values[f.id] ?? null : null;
    })(),
    message: messageField ? values[messageField.id] ?? null : null,
    source: "site",
    status: "nouveau" as const,
    form_data: values,
  };

  const { data: inserted, error: insertError } = await supabase.from("leads").insert(leadRow).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  // Best-effort AI qualification — never blocks the visitor's submission.
  if (isAIConfigured()) {
    try {
      const { data: profile } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("project_id", form.project_id)
        .maybeSingle<BusinessProfile>();
      if (profile) {
        const qualification = await orchestrator.leadQualifier.qualify(profile, {
          message: leadRow.message,
          form_data: leadRow.form_data,
          source: leadRow.source,
        });
        await supabase
          .from("leads")
          .update({
            status: qualification.status,
            notes: [{ id: crypto.randomUUID(), body: `Qualification IA : ${qualification.reasoning}`, created_at: new Date().toISOString() }],
          })
          .eq("id", inserted.id);
      }
    } catch {
      // Non-blocking.
    }
  }

  return NextResponse.json({ success: true });
}
