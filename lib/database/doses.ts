import { localDateStr } from '@/lib/date';
import type { Dose, DoseStatus, MedicineType } from '@/types';
import { getDb, requireActiveProfileId } from './connection';

function rowToDose(row: Record<string, unknown>): Dose {
  return {
    id: row.id as number,
    profileId: row.profile_id as number,
    scheduleId: row.schedule_id as number,
    medicineId: row.medicine_id as number,
    medicineName: (row.medicine_name as string | null) ?? undefined,
    medicineType: (row.medicine_type as MedicineType | null) ?? undefined,
    medicinePhotoUri: (row.medicine_photo_uri as string | null) ?? undefined,
    dosage: (row.dosage as string | null) ?? undefined,
    scheduledTime: row.scheduled_time as string,
    takenTime: (row.taken_time as string | null) ?? undefined,
    status: row.status as DoseStatus,
    skipReason: (row.skip_reason as string | null) ?? undefined,
    notificationId: (row.notification_id as string | null) ?? undefined,
  };
}

export async function getDosesForDate(date: string): Promise<Dose[]> {
  const profileId = requireActiveProfileId();
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.profile_id = ?
      AND date(d.scheduled_time) = ?
    ORDER BY d.scheduled_time ASC
  `,
    [profileId, date]
  );
  return rows.map(rowToDose);
}

export async function getDoseById(id: number): Promise<Dose | null> {
  const profileId = requireActiveProfileId();
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.id = ?
      AND d.profile_id = ?
  `,
    [id, profileId]
  );
  return row ? rowToDose(row) : null;
}

export async function updateDoseStatus(
  id: number,
  status: DoseStatus,
  takenTime?: string,
  skipReason?: string
) {
  const profileId = requireActiveProfileId();
  const db = getDb();
  // fire-and-forget after write (import is lazy to avoid circular deps)
  const scheduleWidgetUpdate = () =>
    import('@/lib/widget-bridge').then(m => m.updateWidgetData()).catch(() => {});

  const current = await db.getFirstAsync<{
    status: string;
    schedule_id: number;
    medicine_id: number;
  }>('SELECT status, schedule_id, medicine_id FROM doses WHERE id = ? AND profile_id = ?', [
    id,
    profileId,
  ]);

  await db.runAsync(
    `UPDATE doses SET status = ?, taken_time = ?, skip_reason = ? WHERE id = ? AND profile_id = ?`,
    [status, takenTime ?? null, skipReason ?? null, id, profileId]
  );

  if (current) {
    const wasTaken = current.status === 'taken';
    const isTaken = status === 'taken';

    if (wasTaken !== isTaken) {
      const sched = await db.getFirstAsync<{ dose_quantity: number }>(
        'SELECT dose_quantity FROM schedules WHERE id = ? AND profile_id = ?',
        [current.schedule_id, profileId]
      );
      const qty = sched?.dose_quantity ?? 1;

      if (isTaken) {
        await db.runAsync(
          'UPDATE medicines SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ? AND profile_id = ?',
          [qty, current.medicine_id, profileId]
        );
      } else {
        await db.runAsync(
          'UPDATE medicines SET stock_quantity = stock_quantity + ? WHERE id = ? AND profile_id = ?',
          [qty, current.medicine_id, profileId]
        );
      }
    }
  }

  scheduleWidgetUpdate();
}

export async function updateDoseScheduleTime(
  id: number,
  scheduledTime: string,
  status: DoseStatus
) {
  const profileId = requireActiveProfileId();
  const db = getDb();
  const current = await db.getFirstAsync<{ notification_id: string | null }>(
    'SELECT notification_id FROM doses WHERE id = ? AND profile_id = ?',
    [id, profileId]
  );

  await db.runAsync(
    'UPDATE doses SET scheduled_time = ?, status = ? WHERE id = ? AND profile_id = ?',
    [scheduledTime, status, id, profileId]
  );

  if (current?.notification_id) {
    const { cancelNotification } = await import('@/lib/notifications');
    await cancelNotification(current.notification_id).catch(() => {});
  }

  const { scheduleDoseNotification } = await import('@/lib/notifications');
  const dose = await getDoseById(id);
  if (dose?.status === 'pending') {
    const notifId = await scheduleDoseNotification({
      id: dose.id,
      medicineName: dose.medicineName ?? '',
      dosage: dose.dosage ?? '',
      scheduledTime: dose.scheduledTime,
    });
    if (notifId) await updateDoseNotificationId(dose.id, notifId);
  }
}

export async function updateDoseNotificationId(id: number, notificationId: string) {
  const profileId = requireActiveProfileId();
  await getDb().runAsync('UPDATE doses SET notification_id = ? WHERE id = ? AND profile_id = ?', [
    notificationId,
    id,
    profileId,
  ]);
}

export async function getDatesWithDosesInMonth(year: number, month: number): Promise<Set<string>> {
  const profileId = requireActiveProfileId();
  const mm = String(month + 1).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const rows = await getDb().getAllAsync<{ date: string }>(
    `SELECT DISTINCT substr(scheduled_time, 1, 10) as date
     FROM doses
     WHERE profile_id = ?
       AND substr(scheduled_time, 1, 10) >= ?
       AND substr(scheduled_time, 1, 10) <= ?`,
    [profileId, startDate, endDate]
  );
  return new Set(rows.map(r => r.date));
}

export async function getDosesForDateRange(startDate: string, endDate: string): Promise<Dose[]> {
  const profileId = requireActiveProfileId();
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.profile_id = ?
      AND date(d.scheduled_time) BETWEEN ? AND ?
    ORDER BY d.scheduled_time ASC
  `,
    [profileId, startDate, endDate]
  );
  return rows.map(rowToDose);
}

export async function getPendingDosesWithoutNotification(): Promise<Dose[]> {
  const profileId = requireActiveProfileId();
  // scheduled_time e gravado em horario local sem separador "T" trocado por
  // espaco (formato toLocalISOString). datetime('now') do SQLite e UTC e usa
  // espaco como separador -- comparar os dois direto e incorreto tanto pelo
  // fuso quanto pelo "T" (ASCII maior que espaco) sempre vencer na comparacao
  // de string. Passamos o "agora" local no mesmo formato para comparar como
  // igual.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const nowLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.profile_id = ?
      AND d.status = 'pending'
      AND d.scheduled_time > ?
      AND (d.notification_id IS NULL OR d.notification_id = '')
    ORDER BY d.scheduled_time ASC
  `,
    [profileId, nowLocal]
  );
  return rows.map(rowToDose);
}

export interface DayAdherence {
  date: string; // YYYY-MM-DD
  total: number;
  taken: number;
  rate: number; // 0-1
}

export async function getWeekAdherence(): Promise<DayAdherence[]> {
  const profileId = requireActiveProfileId();
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const rows = await getDb().getAllAsync<{ date: string; total: number; taken: number }>(
    `
    SELECT
      date(scheduled_time) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
    FROM doses
    WHERE profile_id = ?
      AND date(scheduled_time) >= ?
      AND date(scheduled_time) <= ?
    GROUP BY date(scheduled_time)
    ORDER BY date ASC
  `,
    [profileId, localDateStr(weekAgo), localDateStr(today)]
  );
  return rows.map(r => ({ ...r, rate: r.total > 0 ? r.taken / r.total : 0 }));
}

export async function getAdherenceStreak(): Promise<number> {
  const profileId = requireActiveProfileId();
  const today = new Date();
  const rows = await getDb().getAllAsync<{ date: string; total: number; taken: number }>(
    `
    SELECT
      date(scheduled_time) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
    FROM doses
    WHERE profile_id = ?
      AND date(scheduled_time) < ?
      AND status != 'pending'
    GROUP BY date(scheduled_time)
    ORDER BY date DESC
    LIMIT 90
  `,
    [profileId, localDateStr(today)]
  );

  let streak = 0;
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - (i + 1));
    const expectedStr = localDateStr(expected);
    const row = rows[i];
    if (row.date !== expectedStr) break;
    if (row.total > 0 && row.taken / row.total >= 0.8) streak++;
    else break;
  }
  return streak;
}

export async function getRecentHistory(limit = 50): Promise<Dose[]> {
  const profileId = requireActiveProfileId();
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.profile_id = ?
      AND d.status != 'pending'
      AND date(d.scheduled_time) <= ?
    ORDER BY d.scheduled_time DESC
    LIMIT ?
  `,
    [profileId, localDateStr(new Date()), limit]
  );
  return rows.map(rowToDose);
}
