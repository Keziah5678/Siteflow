import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query';
import { getDrop, listDrops } from '@/services/drops';

export function useDrops() {
  return useQuery({ queryKey: qk.drops, queryFn: listDrops });
}

export function useDrop(id: string | undefined) {
  return useQuery({ queryKey: qk.drop(id ?? ''), queryFn: () => getDrop(id!), enabled: !!id });
}
