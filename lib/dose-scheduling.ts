import {
  generateDosesForSchedule,
  getDosesForDateRange,
  updateDoseNotificationId,
  updateDoseStatus,
} from '@/lib/database';
import { scheduleDoseNotification } from '@/lib/notifications';
import type { Schedule } from '@/types';

const DOSE_GENERATION_DAYS_AHEAD = 30;
const NOTIFICATION_WINDOW_DAYS = 7;

// UTC, não local — mesma fórmula usada nas telas antes desta extração.
// scheduled_time é gravado em horário local, então perto da meia-noite em
// fusos atrás de UTC isso pode considerar "hoje" um dia adiantado. Dívida
// pré-existente, não corrigida aqui para preservar o comportamento atual.
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Orquestra os passos que sempre acontecem após criar um Schedule: gera as
 * doses futuras, marca como "skipped" as doses de hoje cujo horário já
 * passou (evita status "atrasado" imediatamente após criar a agenda), e
 * agenda notificações locais para as doses pendentes dentro dos próximos
 * 7 dias.
 */
export async function finalizeNewSchedule(schedule: Schedule, medicineName: string): Promise<void> {
  await generateDosesForSchedule(schedule, DOSE_GENERATION_DAYS_AHEAD);

  const now = new Date();
  const today = todayStr();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + (NOTIFICATION_WINDOW_DAYS - 1));
  const windowEndStr = windowEnd.toISOString().split('T')[0];

  const doses = await getDosesForDateRange(today, windowEndStr);

  for (const dose of doses) {
    if (dose.scheduleId !== schedule.id) continue;

    if (new Date(dose.scheduledTime) <= now) {
      await updateDoseStatus(dose.id, 'skipped');
      continue;
    }

    const notificationId = await scheduleDoseNotification({
      id: dose.id,
      medicineName,
      dosage: schedule.dosage,
      scheduledTime: dose.scheduledTime,
    });
    if (notificationId) await updateDoseNotificationId(dose.id, notificationId);
  }
}
