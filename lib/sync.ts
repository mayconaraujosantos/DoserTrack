import { getAllRows, runQuery } from '@/lib/database';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { SQLiteBindValue } from 'expo-sqlite';

const log = logger.make('Sync');

interface TableSyncConfig {
  table: 'medicines' | 'schedules' | 'doses';
  toCloud: (row: Record<string, unknown>, userId: string) => Record<string, unknown>;
  insertColumns: string[];
  updateColumns: string[]; // inclui 'updated_at'; nunca inclui id/profile_id/created_at
  toLocalParams: (row: Record<string, unknown>) => SQLiteBindValue[]; // mesma ordem de insertColumns
}

const TABLES: TableSyncConfig[] = [
  {
    table: 'medicines',
    toCloud: (m, userId) => ({
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
    }),
    insertColumns: [
      'id',
      'profile_id',
      'name',
      'type',
      'stock_quantity',
      'stock_unit',
      'photo_uri',
      'low_stock_threshold',
      'created_at',
      'updated_at',
    ],
    updateColumns: [
      'name',
      'type',
      'stock_quantity',
      'stock_unit',
      'photo_uri',
      'low_stock_threshold',
      'updated_at',
    ],
    toLocalParams: m =>
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
      ] as SQLiteBindValue[],
  },
  {
    table: 'schedules',
    toCloud: (s, userId) => ({
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
    }),
    insertColumns: [
      'id',
      'profile_id',
      'medicine_id',
      'dosage',
      'frequency_config',
      'start_date',
      'end_date',
      'is_active',
      'created_at',
      'updated_at',
    ],
    updateColumns: [
      'dosage',
      'frequency_config',
      'start_date',
      'end_date',
      'is_active',
      'updated_at',
    ],
    toLocalParams: s =>
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
      ] as SQLiteBindValue[],
  },
  {
    table: 'doses',
    toCloud: (d, userId) => ({
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
    }),
    insertColumns: [
      'id',
      'profile_id',
      'schedule_id',
      'medicine_id',
      'scheduled_time',
      'taken_time',
      'status',
      'skip_reason',
      'notification_id',
      'created_at',
      'updated_at',
    ],
    updateColumns: ['taken_time', 'status', 'skip_reason', 'notification_id', 'updated_at'],
    toLocalParams: d =>
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
      ] as SQLiteBindValue[],
  },
];

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function upsertTableToCloud(config: TableSyncConfig, userId: string): Promise<void> {
  const rows = await getAllRows<Record<string, unknown>>(`SELECT * FROM ${config.table}`);
  if (rows.length === 0) return;
  const { error } = await supabase!.from(config.table).upsert(
    rows.map(r => config.toCloud(r, userId)),
    { onConflict: 'id' }
  );
  if (error) throw error;
}

async function pullTableFromCloud(config: TableSyncConfig, userId: string): Promise<void> {
  const { data, error } = await supabase!.from(config.table).select('*').eq('user_id', userId);
  if (error) throw error;
  if (!data) return;

  const sql = `INSERT INTO ${config.table} (${config.insertColumns.join(', ')})
     VALUES (${config.insertColumns.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${config.updateColumns.map(c => `${c} = excluded.${c}`).join(', ')}
     WHERE excluded.updated_at > ${config.table}.updated_at OR ${config.table}.updated_at IS NULL`;

  for (const row of data) {
    await runQuery(sql, config.toLocalParams(row));
  }
}

export async function syncToCloud(): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const done = log.time('syncToCloud');
  log.info('iniciando sync → cloud, userId:', userId);

  for (const config of TABLES) {
    try {
      await upsertTableToCloud(config, userId);
    } catch (error) {
      log.error(`syncToCloud: falha ao sincronizar ${config.table}:`, error);
    }
  }

  done();
}

export async function pullFromCloud(): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const done = log.time('pullFromCloud');
  log.info('iniciando pull ← cloud, userId:', userId);

  for (const config of TABLES) {
    try {
      await pullTableFromCloud(config, userId);
    } catch (error) {
      log.error(`pullFromCloud: falha ao sincronizar ${config.table}:`, error);
    }
  }

  done();
}
