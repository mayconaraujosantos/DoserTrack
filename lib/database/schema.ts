import * as SQLite from 'expo-sqlite';
import { getDb, setDb } from './connection';
import { ensureDefaultProfile } from './profiles';

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows = await getDb().getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some(row => row.name === column);
}

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  if (await tableHasColumn(table, column)) return;
  await getDb().execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export async function initDatabase() {
  setDb(await SQLite.openDatabaseAsync('doser.db'));
  const db = getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#4A90D9',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      stock_quantity REAL NOT NULL DEFAULT 0,
      stock_unit TEXT NOT NULL DEFAULT 'unidades',
      photo_uri TEXT,
      low_stock_threshold REAL DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL DEFAULT 1,
      medicine_id INTEGER NOT NULL,
      dosage TEXT NOT NULL,
      frequency_config TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS doses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL DEFAULT 1,
      schedule_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      scheduled_time TEXT NOT NULL,
      taken_time TEXT,
      status TEXT DEFAULT 'pending',
      skip_reason TEXT,
      notification_id TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prescription_cache (
      hash TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await ensureColumn('medicines', 'profile_id', 'INTEGER');
  await ensureColumn('schedules', 'profile_id', 'INTEGER');
  await ensureColumn('doses', 'profile_id', 'INTEGER');
  await ensureColumn('medicines', 'updated_at', 'TEXT');
  await ensureColumn('schedules', 'updated_at', 'TEXT');
  await ensureColumn('doses', 'updated_at', 'TEXT');
  await ensureColumn('schedules', 'dose_quantity', 'REAL NOT NULL DEFAULT 1');

  const defaultProfile = await ensureDefaultProfile();

  await db.runAsync(
    'UPDATE medicines SET profile_id = ? WHERE profile_id IS NULL OR profile_id = 0',
    [defaultProfile.id]
  );
  await db.runAsync(
    'UPDATE schedules SET profile_id = ? WHERE profile_id IS NULL OR profile_id = 0',
    [defaultProfile.id]
  );
  await db.runAsync('UPDATE doses SET profile_id = ? WHERE profile_id IS NULL OR profile_id = 0', [
    defaultProfile.id,
  ]);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_medicines_profile_id ON medicines(profile_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_profile_id ON schedules(profile_id);
    CREATE INDEX IF NOT EXISTS idx_doses_profile_id ON doses(profile_id);
    CREATE INDEX IF NOT EXISTS idx_doses_scheduled_time ON doses(scheduled_time);
  `);
}
