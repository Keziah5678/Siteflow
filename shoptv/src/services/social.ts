import { uid } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type { Comment, Review } from '@/types/models';

import { demoDb } from './demo-db';
import { mapComment, mapReview } from './mappers';

export async function listReviews(productId: string, limit = 10): Promise<Review[]> {
  if (!supabase) {
    return demoDb.reviews.filter((r) => r.productId === productId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapReview);
}

export async function addReview(productId: string, rating: number, title: string, body: string): Promise<Review> {
  const { profile } = useSession.getState();
  if (!profile) throw new Error('Connectez-vous pour publier un avis.');
  const authorName = profile.fullName || 'Client SHOPTV';
  if (!supabase) {
    const review: Review = { id: uid(), productId, userId: profile.id, authorName, rating, title, body, createdAt: new Date().toISOString() };
    demoDb.reviews.unshift(review);
    return review;
  }
  const { data, error } = await supabase
    .from('reviews')
    .insert({ product_id: productId, user_id: profile.id, author_name: authorName, rating, title, body })
    .select()
    .single();
  if (error) throw new Error(error.code === '23505' ? 'Vous avez déjà publié un avis pour ce produit.' : error.message);
  return mapReview(data);
}

export async function listComments(productId: string, limit = 30): Promise<Comment[]> {
  if (!supabase) {
    return demoDb.comments.filter((c) => c.productId === productId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapComment);
}

export async function addComment(productId: string, body: string): Promise<Comment> {
  const { profile } = useSession.getState();
  if (!profile) throw new Error('Connectez-vous pour commenter.');
  const text = body.trim().slice(0, 500);
  if (!text) throw new Error('Commentaire vide.');
  const authorName = profile.fullName || 'Membre SHOPTV';
  if (!supabase) {
    const comment: Comment = { id: uid(), productId, userId: profile.id, authorName, body: text, createdAt: new Date().toISOString() };
    demoDb.comments.unshift(comment);
    const p = demoDb.products.find((x) => x.id === productId);
    if (p) p.commentsCount += 1;
    return comment;
  }
  const { data, error } = await supabase
    .from('comments')
    .insert({ product_id: productId, user_id: profile.id, author_name: authorName, body: text })
    .select()
    .single();
  if (error) throw error;
  return mapComment(data);
}
