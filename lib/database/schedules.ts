import type { FrequencyConfig, Schedule } from '@/types';
import { getDb, requireActiveProfileId } from './connection';

// Exportada para uso interno de dose-generation.ts (realignIntervalSchedule);
// não faz parte do barrel público em index.ts.
export function rowToSchedule(row: Record<string, unknown>): Schedule {
  return {
    id: row.id as number,
    profileId: row.profile_id as number,
    medicineId: row.medicine_id as number,
    medicineName: (row.medicine_name as string | null) ?? undefined,
    dosage: row.dosage as string,
    doseQuantity: (row.dose_quantity as number | null) ?? 1,
    frequencyConfig: JSON.parse(row.frequency_config as string) as FrequencyConfig,
    startDate: row.start_date as string,
    endDate: (row.end_date as string | null) ?? undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

export async function getSchedules(): Promise<Schedule[]> {
  const profileId = requireActiveProfileId();
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    `
    SELECT s.*, m.name as medicine_name
    FROM schedules s
    JOIN medicines m ON s.medicine_id = m.id
    WHERE s.profile_id = ?
      AND s.is_active = 1
    ORDER BY s.created_at DESC
  `,
    [profileId]
  );
  return rows.map(rowToSchedule);
}

export async function getSchedulesByMedicine(medicineId: number): Promise<Schedule[]> {
  const profileId = requireActiveProfileId();
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM schedules WHERE medicine_id = ? AND profile_id = ? AND is_active = 1',
    [medicineId, profileId]
  );
  return rows.map(rowToSchedule);
}

export async function createSchedule(
  data: Omit<Schedule, 'id' | 'createdAt' | 'medicineName' | 'profileId'>
): Promise<Schedule> {
  const profileId = requireActiveProfileId();
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO schedules (profile_id, medicine_id, dosage, dose_quantity, frequency_config, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      profileId,
      data.medicineId,
      data.dosage,
      data.doseQuantity ?? 1,
      JSON.stringify(data.frequencyConfig),
      data.startDate,
      data.endDate ?? null,
    ]
  );
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM schedules WHERE id = ? AND profile_id = ?',
    [result.lastInsertRowId, profileId]
  );
  return rowToSchedule(row!);
}

export async function deactivateSchedule(id: number) {
  const profileId = requireActiveProfileId();
  await getDb().runAsync('UPDATE schedules SET is_active = 0 WHERE id = ? AND profile_id = ?', [
    id,
    profileId,
  ]);
}
