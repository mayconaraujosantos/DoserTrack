import { getDatesWithDosesInMonth, getDoseById, getDosesForDate, getDosesForDateRange } from '@/lib/database';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

export function useDosesForDate(date: string) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.doses.day(date),
    queryFn: () => getDosesForDate(date),
    enabled: dbReady,
  });
}

export function useDosesForDateRange(start: string, end: string) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.doses.range(start, end),
    queryFn: () => getDosesForDateRange(start, end),
    enabled: dbReady,
  });
}

export function useDose(id: number) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.doses.detail(id),
    queryFn: () => getDoseById(id),
    enabled: dbReady,
  });
}

export function useDatesWithDosesInMonth(year: number, month: number) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.doses.calendar(year, month),
    queryFn: () => getDatesWithDosesInMonth(year, month),
    enabled: dbReady,
  });
}
