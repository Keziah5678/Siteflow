import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/hooks/useDebounce';
import { qk } from '@/lib/query';
import { searchAll } from '@/services/search';

/** Recherche instantanée (debounce 250 ms, résultats précédents conservés). */
export function useInstantSearch(term: string) {
  const debounced = useDebounce(term.trim(), 250);
  const query = useQuery({
    queryKey: qk.search(debounced),
    queryFn: () => searchAll(debounced),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });
  return { ...query, term: debounced, isTyping: debounced !== term.trim() };
}
