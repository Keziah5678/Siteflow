/** Conversion lignes Supabase (snake_case) → modèles de domaine. */
import { resolveMediaUrl } from '@/lib/media';
import { STORAGE_BUCKETS } from '@/lib/supabase';
import type {
  AppNotification,
  Brand,
  Category,
  Comment,
  Drop,
  Order,
  OrderItem,
  Product,
  ProductMedia,
  Profile,
  Review,
} from '@/types/models';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown, fallback = 0) => (v == null ? fallback : Number(v));

export function mapCategory(r: Row): Category {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    icon: r.icon ?? 'grid-outline',
    imageUrl: r.image_url ? resolveMediaUrl(r.image_url) : null,
    sortOrder: num(r.sort_order),
    isPopular: !!r.is_popular,
    parentId: r.parent_id ?? null,
  };
}

export function mapBrand(r: Row): Brand {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url ? resolveMediaUrl(r.logo_url) : null,
    monogram: r.monogram || String(r.name ?? '?').slice(0, 2).toUpperCase(),
    isFeatured: !!r.is_featured,
  };
}

export function mapMedia(r: Row): ProductMedia {
  const bucket = r.type === 'video' ? STORAGE_BUCKETS.productVideos : STORAGE_BUCKETS.productImages;
  return {
    id: r.id,
    productId: r.product_id,
    type: r.type,
    url: resolveMediaUrl(r.url, bucket),
    posterUrl: r.poster_url ? resolveMediaUrl(r.poster_url) : null,
    sortOrder: num(r.sort_order),
  };
}

export function mapProduct(r: Row): Product {
  const media = Array.isArray(r.media) ? (r.media as Row[]).map(mapMedia).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const firstImage = media.find((m) => m.type === 'image')?.url;
  const firstVideo = media.find((m) => m.type === 'video')?.url;
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    tagline: r.tagline ?? '',
    description: r.description ?? '',
    price: num(r.price),
    compareAtPrice: r.compare_at_price == null ? null : num(r.compare_at_price),
    discountPercentage: num(r.discount_percentage),
    brandId: r.brand_id ?? null,
    categoryId: r.category_id ?? null,
    brand: r.brand ? mapBrand(r.brand) : null,
    category: r.category ? mapCategory(r.category) : null,
    stock: num(r.stock),
    rating: num(r.rating),
    reviewCount: num(r.review_count),
    shippingInfo: r.shipping_info ?? '',
    warranty: r.warranty ?? '',
    features: Array.isArray(r.features) ? r.features : [],
    variants: Array.isArray(r.variants) ? r.variants : [],
    media,
    coverUrl: r.cover_url ? resolveMediaUrl(r.cover_url) : (firstImage ?? ''),
    videoUrl: r.video_url ? resolveMediaUrl(r.video_url, STORAGE_BUCKETS.productVideos) : (firstVideo ?? null),
    likesCount: num(r.likes_count),
    commentsCount: num(r.comments_count),
    sharesCount: num(r.shares_count),
    popularity: num(r.popularity),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    isActive: r.is_active !== false,
  };
}

export function mapDrop(r: Row): Drop {
  const links = Array.isArray(r.drop_products) ? (r.drop_products as Row[]) : [];
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle ?? '',
    description: r.description ?? '',
    imageUrl: resolveMediaUrl(r.image_url),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isMega: !!r.is_mega,
    productIds: links.sort((a, b) => num(a.sort_order) - num(b.sort_order)).map((l) => l.product_id),
    createdAt: r.created_at,
  };
}

export function mapReview(r: Row): Review {
  return {
    id: r.id,
    productId: r.product_id,
    userId: r.user_id ?? '',
    authorName: r.author_name || 'Client SHOPTV',
    rating: num(r.rating),
    title: r.title ?? '',
    body: r.body ?? '',
    createdAt: r.created_at,
  };
}

export function mapComment(r: Row): Comment {
  return {
    id: r.id,
    productId: r.product_id,
    userId: r.user_id ?? '',
    authorName: r.author_name || 'Membre SHOPTV',
    body: r.body,
    createdAt: r.created_at,
  };
}

export function mapOrderItem(r: Row): OrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    productName: r.product_name,
    productImage: resolveMediaUrl(r.product_image),
    variantLabel: r.variant_label ?? null,
    unitPrice: num(r.unit_price),
    quantity: num(r.quantity),
  };
}

export function mapOrder(r: Row): Order {
  return {
    id: r.id,
    userId: r.user_id,
    number: r.number,
    status: r.status,
    subtotal: num(r.subtotal),
    shipping: num(r.shipping),
    total: num(r.total),
    shippingAddress: r.shipping_address,
    paymentMethod: r.payment_method,
    items: Array.isArray(r.items) ? (r.items as Row[]).map(mapOrderItem) : [],
    createdAt: r.created_at,
  };
}

export function mapNotification(r: Row): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? '',
    data: r.data ?? {},
    readAt: r.read_at ?? null,
    createdAt: r.created_at,
  };
}

export function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    email: r.email ?? '',
    fullName: r.full_name ?? '',
    avatarUrl: r.avatar_url ? resolveMediaUrl(r.avatar_url, STORAGE_BUCKETS.avatars) : null,
    role: r.role === 'admin' ? 'admin' : 'user',
    addresses: Array.isArray(r.addresses) ? r.addresses : [],
  };
}

/** Modèle → ligne produit pour l'écriture admin. */
export function productToRow(p: Partial<Product>): Row {
  const row: Row = {
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    description: p.description,
    price: p.price,
    compare_at_price: p.compareAtPrice,
    brand_id: p.brandId,
    category_id: p.categoryId,
    stock: p.stock,
    shipping_info: p.shippingInfo,
    warranty: p.warranty,
    features: p.features,
    variants: p.variants,
    cover_url: p.coverUrl,
    video_url: p.videoUrl,
    is_active: p.isActive,
  };
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
  return row;
}
