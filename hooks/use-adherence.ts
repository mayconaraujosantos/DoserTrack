import { getAdherenceStreak, getWeekAdherence } from '@/lib/database';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

export function useWeekAdherence() {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.adherence.week,
    queryFn: getWeekAdherence,
    enabled: dbReady,
  });
}

export function useAdherenceStreak() {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.adherence.streak,
    queryFn: getAdherenceStreak,
    enabled: dbReady,
  });
}
