import type { FrequencyConfig, Schedule } from '@/types';
import { buildFixedCycleDates, buildIntervalDates, buildSpecificDaysDates } from './calendar';
import { getDb, requireActiveProfileId } from './connection';
import { rowToSchedule } from './schedules';

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function generateDosesForSchedule(schedule: Schedule, daysAhead = 30) {
  const db = getDb();
  const startDate = new Date(schedule.startDate + 'T00:00:00');
  const endDate = schedule.endDate ? new Date(schedule.endDate + 'T23:59:59') : null;
  const now = new Date();
  const genStart = startDate > now ? startDate : now;
  const genEnd = new Date();
  genEnd.setDate(genEnd.getDate() + daysAhead);
  if (endDate && endDate < genStart) return;
  const finalEnd = endDate && endDate < genEnd ? endDate : genEnd;

  const { frequencyConfig: cfg } = schedule;
  let dates: Date[] = [];
  if (cfg.type === 'interval_hours') dates = buildIntervalDates(cfg, genStart, finalEnd);
  else if (cfg.type === 'specific_days') dates = buildSpecificDaysDates(cfg, genStart, finalEnd);
  else if (cfg.type === 'fixed_cycle')
    dates = buildFixedCycleDates(cfg, genStart, finalEnd, startDate);

  for (const d of dates) {
    const localTime = toLocalISOString(d);
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM doses WHERE schedule_id = ? AND scheduled_time = ? AND profile_id = ?',
      [schedule.id, localTime, schedule.profileId]
    );
    if (!existing) {
      await db.runAsync(
        'INSERT INTO doses (profile_id, schedule_id, medicine_id, scheduled_time) VALUES (?, ?, ?, ?)',
        [schedule.profileId, schedule.id, schedule.medicineId, localTime]
      );
    }
  }
}

/**
 * When a dose is taken at a different time than scheduled on an interval_hours
 * schedule, realign future pending doses so they originate from the actual
 * taken time instead of the original anchor.
 *
 * Example: schedule every 8h anchored at 08:00 (→ 08:00, 16:00, 00:00).
 * User takes at 00:15 → future doses become 08:15, 16:15, 00:15.
 */
export async function realignIntervalSchedule(
  scheduleId: number,
  takenTime: string,
  daysAhead = 30
): Promise<void> {
  const profileId = requireActiveProfileId();
  const db = getDb();

  // Load the schedule
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM schedules WHERE id = ? AND profile_id = ? AND is_active = 1',
    [scheduleId, profileId]
  );
  if (!row) return;

  const schedule = rowToSchedule(row);
  const { frequencyConfig } = schedule;
  if (frequencyConfig.type !== 'interval_hours' || !frequencyConfig.intervalHours) return;

  const takenDate = new Date(takenTime);
  const intervalMs = frequencyConfig.intervalHours * 3_600_000;
  const now = new Date();

  // Delete all future pending doses for this schedule
  const pendingRows = await db.getAllAsync<{ id: number; notification_id: string | null }>(
    `SELECT id, notification_id FROM doses
     WHERE schedule_id = ? AND profile_id = ? AND status = 'pending' AND scheduled_time > ?`,
    [scheduleId, profileId, toLocalISOString(now)]
  );

  for (const pending of pendingRows) {
    if (pending.notification_id) {
      // Cancel existing notification — imported lazily to avoid circular dep
      const { cancelNotification } = await import('@/lib/notifications');
      await cancelNotification(pending.notification_id).catch(() => {});
    }
    await db.runAsync('DELETE FROM doses WHERE id = ? AND profile_id = ?', [pending.id, profileId]);
  }

  // Regenerate doses starting from takenTime + 1 interval
  const genEnd = new Date(now.getTime() + daysAhead * 24 * 3_600_000);
  const endDate = schedule.endDate ? new Date(schedule.endDate + 'T23:59:59') : null;
  const finalEnd = endDate && endDate < genEnd ? endDate : genEnd;

  let next = new Date(takenDate.getTime() + intervalMs);
  const newDates: Date[] = [];
  while (next <= finalEnd) {
    if (next > now) newDates.push(new Date(next));
    next = new Date(next.getTime() + intervalMs);
  }

  // Update the anchor time in frequencyConfig so future regeneration stays aligned
  const pad = (n: number) => String(n).padStart(2, '0');
  const newAnchor = `${pad(takenDate.getHours())}:${pad(takenDate.getMinutes())}`;
  const updatedConfig: FrequencyConfig = { ...frequencyConfig, times: [newAnchor] };
  await db.runAsync('UPDATE schedules SET frequency_config = ? WHERE id = ? AND profile_id = ?', [
    JSON.stringify(updatedConfig),
    scheduleId,
    profileId,
  ]);

  // Insert new doses
  for (const d of newDates) {
    const localTime = toLocalISOString(d);
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM doses WHERE schedule_id = ? AND scheduled_time = ? AND profile_id = ?',
      [scheduleId, localTime, profileId]
    );
    if (!existing) {
      await db.runAsync(
        'INSERT INTO doses (profile_id, schedule_id, medicine_id, scheduled_time) VALUES (?, ?, ?, ?)',
        [profileId, scheduleId, schedule.medicineId, localTime]
      );
    }
  }
}
