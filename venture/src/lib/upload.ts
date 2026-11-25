"use client";
import { createClient } from "@/lib/supabase/client";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function uploadPublicImage(bucket: "avatars" | "covers", userId: string, file: File, maxBytes: number): Promise<{ url?: string; error?: string }> {
  if (!IMAGE_TYPES.includes(file.type)) return { error: "Format accepté : PNG, JPEG ou WebP." };
  if (file.size > maxBytes) return { error: `Image trop lourde (${Math.round(maxBytes / 1048576)} Mo maximum).` };
  const ext = file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "Échec de l'envoi de l'image." };
  return { url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

export async function uploadPrivateFile(bucket: "project-files" | "message-files", folder: string, file: File, maxBytes: number): Promise<{ path?: string; error?: string }> {
  if (file.size > maxBytes) return { error: `Fichier trop lourd (${Math.round(maxBytes / 1048576)} Mo maximum).` };
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${folder}/${crypto.randomUUID()}-${safe}`;
  const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { error: "Échec de l'envoi du fichier." };
  return { path };
}
