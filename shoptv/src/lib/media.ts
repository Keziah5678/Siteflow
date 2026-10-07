import { STORAGE_BUCKETS, supabase } from './supabase';

type Bucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Résout une référence média en URL affichable.
 * - URL absolue (prototype, CDN) → renvoyée telle quelle.
 * - Chemin `bucket/chemin/fichier.ext` → URL publique Supabase Storage.
 */
export function resolveMediaUrl(ref: string | null | undefined, fallbackBucket: Bucket = STORAGE_BUCKETS.productImages): string {
  if (!ref) return '';
  if (/^(https?:|data:|file:|blob:)/.test(ref)) return ref;
  if (!supabase) return ref;
  const [first, ...rest] = ref.split('/');
  const known = Object.values(STORAGE_BUCKETS) as string[];
  const bucket = known.includes(first) ? first : fallbackBucket;
  const path = known.includes(first) ? rest.join('/') : ref;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Image Unsplash optimisée (prototype uniquement — remplacée par Supabase Storage en prod). */
export function unsplash(id: string, width = 900): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`;
}
