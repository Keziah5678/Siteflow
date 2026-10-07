/** Modèles de domaine utilisés par l'UI (camelCase, indépendants de la base). */

export type UUID = string;

export type MediaType = 'image' | 'video';

export interface ProductMedia {
  id: UUID;
  productId: UUID;
  type: MediaType;
  url: string;
  posterUrl?: string | null;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  label: string;
  value: string;
  colorHex?: string;
}

export interface Category {
  id: UUID;
  name: string;
  slug: string;
  icon: string;
  imageUrl: string | null;
  sortOrder: number;
  isPopular: boolean;
  parentId: UUID | null;
}

export interface Brand {
  id: UUID;
  name: string;
  slug: string;
  logoUrl: string | null;
  monogram: string;
  isFeatured: boolean;
}

export interface Product {
  id: UUID;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  discountPercentage: number;
  brandId: UUID | null;
  categoryId: UUID | null;
  brand?: Brand | null;
  category?: Category | null;
  stock: number;
  rating: number;
  reviewCount: number;
  shippingInfo: string;
  warranty: string;
  features: string[];
  variants: ProductVariant[];
  media: ProductMedia[];
  coverUrl: string;
  videoUrl: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  popularity: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export type DropStatus = 'upcoming' | 'live' | 'ended';

export interface Drop {
  id: UUID;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  isMega: boolean;
  productIds: UUID[];
  createdAt: string;
}

export interface Review {
  id: UUID;
  productId: UUID;
  userId: UUID;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
}

export interface Comment {
  id: UUID;
  productId: UUID;
  userId: UUID;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CartLine {
  productId: UUID;
  variantId: string | null;
  quantity: number;
}

export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: UUID;
  orderId: UUID;
  productId: UUID;
  productName: string;
  productImage: string;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
}

export interface Address {
  fullName: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: UUID;
  userId: UUID;
  number: string;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  shippingAddress: Address;
  paymentMethod: string;
  items: OrderItem[];
  createdAt: string;
}

export type NotificationType =
  | 'drop_soon'
  | 'drop_live'
  | 'price_drop'
  | 'back_in_stock'
  | 'order'
  | 'shipping'
  | 'promotion';

export interface AppNotification {
  id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export type UserRole = 'user' | 'admin';

export interface Profile {
  id: UUID;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  addresses: Address[];
}

export interface NotificationSettings {
  drops: boolean;
  priceDrops: boolean;
  orders: boolean;
  promotions: boolean;
}

export type FavoriteKind = 'product' | 'video';

export interface FavoriteRef {
  productId: UUID;
  kind: FavoriteKind;
}

export type UserEventType = 'view_product' | 'view_category' | 'like' | 'favorite' | 'purchase' | 'watch';

export interface UserEvent {
  type: UserEventType;
  productId?: UUID;
  categoryId?: UUID | null;
  /** Durée de visionnage en secondes pour `watch`. */
  value?: number;
  at: number;
}

export interface Page<T> {
  items: T[];
  nextOffset: number | null;
}

export type ProductSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'discount' | 'popular';

export interface ProductQuery {
  categorySlug?: string | null;
  brandSlug?: string | null;
  search?: string;
  sort?: ProductSort;
  ids?: UUID[];
  excludeId?: UUID;
  offset?: number;
  limit?: number;
}
