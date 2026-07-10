import { getMedicineById, getMedicines } from '@/lib/database';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

export function useMedicines() {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.medicines.all,
    queryFn: getMedicines,
    enabled: dbReady,
  });
}

export function useMedicine(id: number) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.medicines.detail(id),
    queryFn: () => getMedicineById(id),
    enabled: dbReady,
  });
}
