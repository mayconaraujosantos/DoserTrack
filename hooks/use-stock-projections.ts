import { getStockProjections } from '@/lib/database';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

export function useStockProjections() {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.stockProjections,
    queryFn: getStockProjections,
    enabled: dbReady,
  });
}
