import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query';
import { addComment, addReview, listComments, listReviews } from '@/services/social';

export function useReviews(productId: string | undefined) {
  return useQuery({ queryKey: qk.reviews(productId ?? ''), queryFn: () => listReviews(productId!), enabled: !!productId });
}

export function useComments(productId: string | undefined, enabled = true) {
  return useQuery({ queryKey: qk.comments(productId ?? ''), queryFn: () => listComments(productId!), enabled: !!productId && enabled });
}

export function useAddComment(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addComment(productId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.comments(productId) }),
  });
}

export function useAddReview(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { rating: number; title: string; body: string }) => addReview(productId, v.rating, v.title, v.body),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.reviews(productId) }),
  });
}
