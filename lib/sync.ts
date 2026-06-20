import { supabase } from '@/lib/supabase';
import { getDatabase } from '@/lib/database';
import { logger } from '@/lib/logger';

const log = logger.make('Sync');

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function syncToCloud(): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const done = log.time('syncToCloud');
  log.info('iniciando sync → cloud, userId:', userId);

  const db = getDatabase();

  const medicines = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM medicines');
  if (medicines.length > 0) {
    await supabase.from('medicines').upsert(
      medicines.map(m => ({
        id: m.id,
        user_id: userId,
        profile_id: m.profile_id,
        name: m.name,
        type: m.type,
        stock_quantity: m.stock_quantity,
        stock_unit: m.stock_unit,
        photo_uri: m.photo_uri ?? null,
        low_stock_threshold: m.low_stock_threshold,
        updated_at: m.updated_at ?? new Date().toISOString(),
        created_at: m.created_at,
      })),
      { onConflict: 'id' }
    );
  }

  const schedules = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM schedules');
  if (schedules.length > 0) {
    await supabase.from('schedules').upsert(
      schedules.map(s => ({
        id: s.id,
        user_id: userId,
        profile_id: s.profile_id,
        medicine_id: s.medicine_id,
        dosage: s.dosage,
        frequency_config: s.frequency_config,
        start_date: s.start_date,
        end_date: s.end_date ?? null,
        is_active: s.is_active,
        updated_at: s.updated_at ?? new Date().toISOString(),
        created_at: s.created_at,
      })),
      { onConflict: 'id' }
    );
  }

  const doses = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM doses');
  if (doses.length > 0) {
    await supabase.from('doses').upsert(
      doses.map(d => ({
        id: d.id,
        user_id: userId,
        profile_id: d.profile_id,
        schedule_id: d.schedule_id,
        medicine_id: d.medicine_id,
        scheduled_time: d.scheduled_time,
        taken_time: d.taken_time ?? null,
        status: d.status,
        skip_reason: d.skip_reason ?? null,
        notification_id: d.notification_id ?? null,
        updated_at: d.updated_at ?? new Date().toISOString(),
        created_at: d.created_at,
      })),
      { onConflict: 'id' }
    );
  }
  done();
}

export async function pullFromCloud(): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const done = log.time('pullFromCloud');
  log.info('iniciando pull ← cloud, userId:', userId);

  const db = getDatabase();

  const { data: medicines } = await supabase.from('medicines').select('*').eq('user_id', userId);

  if (medicines) {
    for (const m of medicines) {
      await db.runAsync(
        `INSERT INTO medicines
          (id, profile_id, name, type, stock_quantity, stock_unit, photo_uri, low_stock_threshold, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, type = excluded.type,
           stock_quantity = excluded.stock_quantity, stock_unit = excluded.stock_unit,
           photo_uri = excluded.photo_uri, low_stock_threshold = excluded.low_stock_threshold,
           updated_at = excluded.updated_at
         WHERE excluded.updated_at > medicines.updated_at OR medicines.updated_at IS NULL`,
        [
          m.id,
          m.profile_id,
          m.name,
          m.type,
          m.stock_quantity,
          m.stock_unit,
          m.photo_uri ?? null,
          m.low_stock_threshold,
          m.created_at,
          m.updated_at ?? null,
        ]
      );
    }
  }

  const { data: schedules } = await supabase.from('schedules').select('*').eq('user_id', userId);

  if (schedules) {
    for (const s of schedules) {
      await db.runAsync(
        `INSERT INTO schedules
          (id, profile_id, medicine_id, dosage, frequency_config, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           dosage = excluded.dosage, frequency_config = excluded.frequency_config,
           start_date = excluded.start_date, end_date = excluded.end_date,
           is_active = excluded.is_active, updated_at = excluded.updated_at
         WHERE excluded.updated_at > schedules.updated_at OR schedules.updated_at IS NULL`,
        [
          s.id,
          s.profile_id,
          s.medicine_id,
          s.dosage,
          s.frequency_config,
          s.start_date,
          s.end_date ?? null,
          s.is_active ? 1 : 0,
          s.created_at,
          s.updated_at ?? null,
        ]
      );
    }
  }

  const { data: doses } = await supabase.from('doses').select('*').eq('user_id', userId);

  if (doses) {
    for (const d of doses) {
      await db.runAsync(
        `INSERT INTO doses
          (id, profile_id, schedule_id, medicine_id, scheduled_time, taken_time, status, skip_reason, notification_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           taken_time = excluded.taken_time, status = excluded.status,
           skip_reason = excluded.skip_reason, notification_id = excluded.notification_id,
           updated_at = excluded.updated_at
         WHERE excluded.updated_at > doses.updated_at OR doses.updated_at IS NULL`,
        [
          d.id,
          d.profile_id,
          d.schedule_id,
          d.medicine_id,
          d.scheduled_time,
          d.taken_time ?? null,
          d.status,
          d.skip_reason ?? null,
          d.notification_id ?? null,
          d.created_at,
          d.updated_at ?? null,
        ]
      );
    }
  }
  done();
}
