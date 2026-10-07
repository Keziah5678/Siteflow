import { getDropStatus } from '@/lib/drops';
import { uid } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import type { Drop, DropStatus } from '@/types/models';

import { demoDb } from './demo-db';
import { mapDrop } from './mappers';

const DROP_SELECT = '*, drop_products(product_id, sort_order)';

export async function listDrops(): Promise<Drop[]> {
  if (!supabase) return [...demoDb.drops].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const { data, error } = await supabase.from('drops').select(DROP_SELECT).order('starts_at');
  if (error) throw error;
  return (data ?? []).map(mapDrop);
}

export async function getDrop(id: string): Promise<Drop | null> {
  if (!supabase) return demoDb.drops.find((d) => d.id === id) ?? null;
  const { data, error } = await supabase.from('drops').select(DROP_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapDrop(data) : null;
}

/** Regroupe les drops par statut, calculé à l'instant `now`. */
export function groupDrops(drops: Drop[], now = Date.now()): Record<DropStatus, Drop[]> {
  const groups: Record<DropStatus, Drop[]> = { live: [], upcoming: [], ended: [] };
  for (const d of drops) groups[getDropStatus(d, now)].push(d);
  groups.ended.sort((a, b) => b.endsAt.localeCompare(a.endsAt));
  return groups;
}

/** Drop mis en avant sur l'accueil : le Mega Drop non terminé, sinon le prochain. */
export function pickFeaturedDrop(drops: Drop[], now = Date.now()): Drop | null {
  const active = drops.filter((d) => getDropStatus(d, now) !== 'ended');
  return active.find((d) => d.isMega) ?? active[0] ?? null;
}

// ───────────── Administration

export type DropInput = Omit<Drop, 'id' | 'createdAt'>;

export async function saveDrop(input: DropInput, id?: string): Promise<Drop> {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error('La fin du drop doit être postérieure à son début.');
  }
  if (!supabase) {
    if (id) {
      const idx = demoDb.drops.findIndex((d) => d.id === id);
      demoDb.drops[idx] = { ...demoDb.drops[idx], ...input };
      return demoDb.drops[idx];
    }
    const drop: Drop = { ...input, id: uid(), createdAt: new Date().toISOString() };
    demoDb.drops.push(drop);
    return drop;
  }
  const row = {
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    image_url: input.imageUrl,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_mega: input.isMega,
  };
  const { data, error } = id
    ? await supabase.from('drops').update(row).eq('id', id).select().single()
    : await supabase.from('drops').insert(row).select().single();
  if (error) throw error;

  const dropId = data.id as string;
  const { error: delError } = await supabase.from('drop_products').delete().eq('drop_id', dropId);
  if (delError) throw delError;
  if (input.productIds.length) {
    const { error: linkError } = await supabase
      .from('drop_products')
      .insert(input.productIds.map((product_id, sort_order) => ({ drop_id: dropId, product_id, sort_order })));
    if (linkError) throw linkError;
  }
  return { ...mapDrop(data), productIds: input.productIds };
}

export async function deleteDrop(id: string): Promise<void> {
  if (!supabase) {
    demoDb.drops.splice(
      demoDb.drops.findIndex((d) => d.id === id),
      1,
    );
    return;
  }
  const { error } = await supabase.from('drops').delete().eq('id', id);
  if (error) throw error;
}
