import { getScheduleById, getSchedules, getSchedulesByMedicine } from '@/lib/database';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

export function useSchedules() {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.schedules.all,
    queryFn: getSchedules,
    enabled: dbReady,
  });
}

export function useSchedulesByMedicine(medicineId: number) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.schedules.byMedicine(medicineId),
    queryFn: () => getSchedulesByMedicine(medicineId),
    enabled: dbReady && !!medicineId,
  });
}

export function useSchedule(id: number) {
  const dbReady = useAppStore(s => s.dbReady);
  return useQuery({
    queryKey: queryKeys.schedules.detail(id),
    queryFn: () => getScheduleById(id),
    enabled: dbReady && !!id,
  });
}
