/**
 * Opérations d'administration. Côté Supabase, toutes ces écritures sont
 * protégées par RLS (`is_admin()`) : un utilisateur standard est refusé
 * par la base, même s'il contourne l'interface.
 */
import { discountOf } from '@/lib/format';
import { slugify, uid } from '@/lib/slug';
import { STORAGE_BUCKETS, supabase } from '@/lib/supabase';
import { useDemoAccount } from '@/store/demo-account';
import type { Brand, Category, Order, OrderStatus, Product, Profile } from '@/types/models';

import { invalidateCategories, PRODUCT_SELECT } from './catalog';
import { demoDb, hydrateDemoProduct } from './demo-db';
import { mapOrder, mapProduct, mapProfile, productToRow } from './mappers';

export interface AdminStats {
  revenue: number;
  orders: number;
  users: number;
  products: number;
  salesByDay: { day: string; total: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  popularProducts: Pick<Product, 'id' | 'name' | 'likesCount' | 'popularity' | 'coverUrl'>[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const popular = await listAdminProducts();
  const popularProducts = [...popular]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 5)
    .map(({ id, name, likesCount, popularity, coverUrl }) => ({ id, name, likesCount, popularity, coverUrl }));

  if (!supabase) {
    const orders = useDemoAccount.getState().orders.filter((o) => o.status !== 'cancelled');
    const byDay = new Map<string, number>();
    const byProduct = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>();
    for (const o of orders) {
      const day = o.createdAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + o.total);
      for (const it of o.items) {
        const cur = byProduct.get(it.productId) ?? { productId: it.productId, name: it.productName, quantity: 0, revenue: 0 };
        cur.quantity += it.quantity;
        cur.revenue += it.quantity * it.unitPrice;
        byProduct.set(it.productId, cur);
      }
    }
    return {
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: orders.length,
      users: 1,
      products: demoDb.products.filter((p) => p.isActive).length,
      salesByDay: [...byDay.entries()].sort().map(([day, total]) => ({ day, total })),
      topProducts: [...byProduct.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      popularProducts,
    };
  }

  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw error;
  const s = data as Omit<AdminStats, 'popularProducts'>;
  return {
    revenue: Number(s.revenue),
    orders: Number(s.orders),
    users: Number(s.users),
    products: Number(s.products),
    salesByDay: (s.salesByDay ?? []).map((d) => ({ day: d.day, total: Number(d.total) })),
    topProducts: (s.topProducts ?? []).map((t) => ({ ...t, quantity: Number(t.quantity), revenue: Number(t.revenue) })),
    popularProducts,
  };
}

// ───────────── Produits

export async function listAdminProducts(): Promise<Product[]> {
  if (!supabase) return demoDb.products.map(hydrateDemoProduct);
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export type ProductInput = Pick<
  Product,
  | 'name'
  | 'tagline'
  | 'description'
  | 'price'
  | 'compareAtPrice'
  | 'brandId'
  | 'categoryId'
  | 'stock'
  | 'shippingInfo'
  | 'warranty'
  | 'features'
  | 'variants'
  | 'coverUrl'
  | 'videoUrl'
  | 'isActive'
> & { slug?: string };

export async function saveProduct(input: ProductInput, id?: string): Promise<Product> {
  if (!input.name.trim()) throw new Error('Le nom est obligatoire.');
  if (!(input.price >= 0)) throw new Error('Prix invalide.');
  const slug = input.slug?.trim() || slugify(input.name);

  if (!supabase) {
    const now = new Date().toISOString();
    if (id) {
      const idx = demoDb.products.findIndex((p) => p.id === id);
      demoDb.products[idx] = {
        ...demoDb.products[idx],
        ...input,
        slug,
        discountPercentage: discountOf(input.price, input.compareAtPrice),
        updatedAt: now,
      };
      return hydrateDemoProduct(demoDb.products[idx]);
    }
    const product: Product = {
      ...input,
      id: uid(),
      slug,
      discountPercentage: discountOf(input.price, input.compareAtPrice),
      rating: 0,
      reviewCount: 0,
      media: [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      popularity: 0,
      createdAt: now,
      updatedAt: now,
    };
    demoDb.products.unshift(product);
    return hydrateDemoProduct(product);
  }

  const row = productToRow({ ...input, slug });
  const { data, error } = id
    ? await supabase.from('products').update(row).eq('id', id).select(PRODUCT_SELECT).single()
    : await supabase.from('products').insert(row).select(PRODUCT_SELECT).single();
  if (error) throw new Error(error.code === '23505' ? 'Ce slug existe déjà.' : error.message);
  return mapProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  if (!supabase) {
    const idx = demoDb.products.findIndex((p) => p.id === id);
    if (idx >= 0) demoDb.products.splice(idx, 1);
    return;
  }
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Envoie un fichier dans Supabase Storage (product-images / product-videos)
 * et l'ajoute à la galerie du produit. Renvoie la référence stockée.
 */
export async function uploadProductMedia(productId: string, localUri: string, type: 'image' | 'video', mimeType: string): Promise<string> {
  if (!supabase) {
    const p = demoDb.products.find((x) => x.id === productId);
    if (p) {
      p.media.push({ id: uid(), productId, type, url: localUri, posterUrl: null, sortOrder: p.media.length });
      if (type === 'image' && !p.coverUrl) p.coverUrl = localUri;
      if (type === 'video') p.videoUrl = localUri;
    }
    return localUri;
  }
  const bucket = type === 'video' ? STORAGE_BUCKETS.productVideos : STORAGE_BUCKETS.productImages;
  const ext = (mimeType.split('/')[1] ?? (type === 'video' ? 'mp4' : 'jpg')).replace('quicktime', 'mov');
  const path = `${productId}/${Date.now()}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: mimeType });
  if (error) throw error;
  const ref = `${bucket}/${path}`;
  const { count } = await supabase.from('product_media').select('id', { count: 'exact', head: true }).eq('product_id', productId);
  const { error: insertError } = await supabase.from('product_media').insert({ product_id: productId, type, url: ref, sort_order: count ?? 0 });
  if (insertError) throw insertError;
  if (type === 'video') await supabase.from('products').update({ video_url: ref }).eq('id', productId);
  return ref;
}

// ───────────── Catégories & marques

export async function saveCategory(input: Pick<Category, 'name' | 'icon' | 'isPopular' | 'parentId' | 'imageUrl'>, id?: string): Promise<void> {
  const slug = slugify(input.name);
  invalidateCategories();
  if (!supabase) {
    if (id) Object.assign(demoDb.categories.find((c) => c.id === id) ?? {}, input, { slug });
    else demoDb.categories.push({ ...input, slug, id: uid(), sortOrder: demoDb.categories.length + 1 });
    return;
  }
  const row = { name: input.name, slug, icon: input.icon, is_popular: input.isPopular, parent_id: input.parentId, image_url: input.imageUrl };
  const { error } = id ? await supabase.from('categories').update(row).eq('id', id) : await supabase.from('categories').insert(row);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  invalidateCategories();
  if (!supabase) {
    demoDb.categories.splice(
      demoDb.categories.findIndex((c) => c.id === id),
      1,
    );
    return;
  }
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function saveBrand(input: Pick<Brand, 'name' | 'isFeatured' | 'monogram' | 'logoUrl'>, id?: string): Promise<void> {
  const slug = slugify(input.name);
  const monogram = input.monogram || input.name.slice(0, 2).toUpperCase();
  if (!supabase) {
    if (id) Object.assign(demoDb.brands.find((b) => b.id === id) ?? {}, input, { slug, monogram });
    else demoDb.brands.push({ ...input, monogram, slug, id: uid() });
    return;
  }
  const row = { name: input.name, slug, monogram, is_featured: input.isFeatured, logo_url: input.logoUrl };
  const { error } = id ? await supabase.from('brands').update(row).eq('id', id) : await supabase.from('brands').insert(row);
  if (error) throw error;
}

export async function deleteBrand(id: string): Promise<void> {
  if (!supabase) {
    demoDb.brands.splice(
      demoDb.brands.findIndex((b) => b.id === id),
      1,
    );
    return;
  }
  const { error } = await supabase.from('brands').delete().eq('id', id);
  if (error) throw error;
}

// ───────────── Commandes & utilisateurs

export async function listAllOrders(): Promise<Order[]> {
  if (!supabase) return useDemoAccount.getState().orders;
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  if (!supabase) {
    useDemoAccount.getState().updateOrder(id, { status });
    return;
  }
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function listUsers(): Promise<Profile[]> {
  if (!supabase) {
    const p = useDemoAccount.getState().profile;
    return p ? [p] : [];
  }
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map(mapProfile);
}
