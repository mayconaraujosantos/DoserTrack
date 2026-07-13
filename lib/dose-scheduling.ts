import {
  generateDosesForSchedule,
  getDosesForDateRange,
  regenerateFutureDosesForSchedule,
  updateDoseNotificationId,
  updateDoseStatus,
} from '@/lib/database';
import { localDateStr } from '@/lib/date';
import { scheduleDoseNotification } from '@/lib/notifications';
import type { Schedule } from '@/types';

const DOSE_GENERATION_DAYS_AHEAD = 30;
const NOTIFICATION_WINDOW_DAYS = 7;

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
  const today = localDateStr();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + (NOTIFICATION_WINDOW_DAYS - 1));
  const windowEndStr = localDateStr(windowEnd);

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

/**
 * Orquestra os passos após editar um Schedule existente: regenera só as
 * doses futuras `pending` sob a nova configuração (preservando doses já
 * tomadas/puladas/adiadas) e reagenda notificações locais para a janela
 * dos próximos 7 dias.
 */
export async function finalizeScheduleUpdate(
  schedule: Schedule,
  medicineName: string
): Promise<void> {
  await regenerateFutureDosesForSchedule(schedule, DOSE_GENERATION_DAYS_AHEAD);

  const today = localDateStr();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + (NOTIFICATION_WINDOW_DAYS - 1));
  const windowEndStr = localDateStr(windowEnd);

  const doses = await getDosesForDateRange(today, windowEndStr);

  for (const dose of doses) {
    if (dose.scheduleId !== schedule.id || dose.status !== 'pending') continue;

    const notificationId = await scheduleDoseNotification({
      id: dose.id,
      medicineName,
      dosage: schedule.dosage,
      scheduledTime: dose.scheduledTime,
    });
    if (notificationId) await updateDoseNotificationId(dose.id, notificationId);
  }
}
