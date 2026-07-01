import type {
  Dose,
  DoseStatus,
  FrequencyConfig,
  Medicine,
  MedicineType,
  Profile,
  Schedule,
  StockProjection,
} from '@/types';
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;
let activeProfileId: number | null = null;

function requireActiveProfileId(): number {
  if (!activeProfileId) {
    throw new Error('Perfil ativo nao configurado.');
  }
  return activeProfileId;
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some(row => row.name === column);
}

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  if (await tableHasColumn(table, column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

async function ensureDefaultProfile(): Promise<Profile> {
  await db.runAsync(
    `INSERT INTO profiles (name, color, is_default)
     SELECT 'Perfil 1', '#4A90D9', 1
     WHERE NOT EXISTS (SELECT 1 FROM profiles)`
  );

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM profiles ORDER BY is_default DESC, created_at ASC LIMIT 1`
  );

  return rowToProfile(row!);
}

export async function initDatabase() {
  db = await SQLite.openDatabaseAsync('doser.db');
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

export async function getAllRows<T = Record<string, unknown>>(
  sql: string,
  params?: SQLite.SQLiteBindParams
): Promise<T[]> {
  if (params === undefined) {
    return db.getAllAsync<T>(sql);
  }
  return db.getAllAsync<T>(sql, params);
}

export async function getFirstRow<T = Record<string, unknown>>(
  sql: string,
  params?: SQLite.SQLiteBindParams
): Promise<T | null> {
  if (params === undefined) {
    return db.getFirstAsync<T>(sql);
  }
  const row = await db.getFirstAsync<T>(sql, params);
  return row ?? null;
}

export async function runQuery(
  sql: string,
  params?: SQLite.SQLiteBindParams
): Promise<SQLite.SQLiteRunResult> {
  if (params === undefined) {
    return db.runAsync(sql);
  }
  return db.runAsync(sql, params);
}

export async function getCachedPrescriptionByHash(hash: string): Promise<{
  result_json: string;
  created_at: number;
} | null> {
  return getFirstRow<{ result_json: string; created_at: number }>(
    'SELECT result_json, created_at FROM prescription_cache WHERE hash = ?',
    [hash]
  );
}

export async function setPrescriptionCache(hash: string, resultJson: string): Promise<void> {
  await runQuery(
    'INSERT OR REPLACE INTO prescription_cache (hash, result_json, created_at) VALUES (?, ?, ?)',
    [hash, resultJson, Date.now()]
  );
}

export async function clearPrescriptionCache(): Promise<void> {
  await runQuery('DELETE FROM prescription_cache');
}

export function setActiveProfileId(profileId: number) {
  activeProfileId = profileId;
}

export function getActiveProfileId() {
  return activeProfileId;
}

// --- Profiles ---

export async function getProfiles(): Promise<Profile[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM profiles ORDER BY is_default DESC, created_at ASC'
  );
  return rows.map(rowToProfile);
}

export async function getProfileById(id: number): Promise<Profile | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM profiles WHERE id = ?',
    [id]
  );
  return row ? rowToProfile(row) : null;
}

export async function createProfile(data: { name: string; color?: string }): Promise<Profile> {
  const result = await db.runAsync(
    'INSERT INTO profiles (name, color, is_default) VALUES (?, ?, 0)',
    [data.name, data.color ?? '#4A90D9']
  );
  return (await getProfileById(result.lastInsertRowId))!;
}

export async function resolveProfile(preferredProfileId?: number | null): Promise<Profile> {
  if (preferredProfileId) {
    const preferred = await getProfileById(preferredProfileId);
    if (preferred) return preferred;
  }
  return ensureDefaultProfile();
}

// --- Medicines ---

export async function getMedicines(): Promise<Medicine[]> {
  const profileId = requireActiveProfileId();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM medicines WHERE profile_id = ? ORDER BY name',
    [profileId]
  );
  return rows.map(rowToMedicine);
}

export async function getMedicineById(id: number): Promise<Medicine | null> {
  const profileId = requireActiveProfileId();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM medicines WHERE id = ? AND profile_id = ?',
    [id, profileId]
  );
  return row ? rowToMedicine(row) : null;
}

export async function createMedicine(
  data: Omit<Medicine, 'id' | 'createdAt' | 'profileId'>
): Promise<Medicine> {
  const profileId = requireActiveProfileId();
  const result = await db.runAsync(
    `INSERT INTO medicines (profile_id, name, type, stock_quantity, stock_unit, photo_uri, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      profileId,
      data.name,
      data.type,
      data.stockQuantity,
      data.stockUnit,
      data.photoUri ?? null,
      data.lowStockThreshold,
    ]
  );
  return (await getMedicineById(result.lastInsertRowId))!;
}

export async function updateMedicine(
  id: number,
  data: Omit<Medicine, 'id' | 'createdAt' | 'profileId'>
): Promise<Medicine> {
  const profileId = requireActiveProfileId();
  await db.runAsync(
    `UPDATE medicines
     SET name = ?, type = ?, stock_quantity = ?, stock_unit = ?, photo_uri = ?, low_stock_threshold = ?
     WHERE id = ? AND profile_id = ?`,
    [
      data.name,
      data.type,
      data.stockQuantity,
      data.stockUnit,
      data.photoUri ?? null,
      data.lowStockThreshold,
      id,
      profileId,
    ]
  );
  return (await getMedicineById(id))!;
}

export async function updateMedicineStock(id: number, newQuantity: number) {
  const profileId = requireActiveProfileId();
  await db.runAsync('UPDATE medicines SET stock_quantity = ? WHERE id = ? AND profile_id = ?', [
    newQuantity,
    id,
    profileId,
  ]);
}

export async function deleteMedicine(id: number) {
  const profileId = requireActiveProfileId();
  await db.runAsync('DELETE FROM medicines WHERE id = ? AND profile_id = ?', [id, profileId]);
}

// --- Schedules ---

export async function getSchedules(): Promise<Schedule[]> {
  const profileId = requireActiveProfileId();
  const rows = await db.getAllAsync<Record<string, unknown>>(
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
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM schedules WHERE medicine_id = ? AND profile_id = ? AND is_active = 1',
    [medicineId, profileId]
  );
  return rows.map(rowToSchedule);
}

export async function createSchedule(
  data: Omit<Schedule, 'id' | 'createdAt' | 'medicineName' | 'profileId'>
): Promise<Schedule> {
  const profileId = requireActiveProfileId();
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
  await db.runAsync('UPDATE schedules SET is_active = 0 WHERE id = ? AND profile_id = ?', [
    id,
    profileId,
  ]);
}

// --- Doses ---

export async function getDosesForDate(date: string): Promise<Dose[]> {
  const profileId = requireActiveProfileId();
  const rows = await db.getAllAsync<Record<string, unknown>>(
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
  const row = await db.getFirstAsync<Record<string, unknown>>(
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

export async function updateDoseNotificationId(id: number, notificationId: string) {
  const profileId = requireActiveProfileId();
  await db.runAsync('UPDATE doses SET notification_id = ? WHERE id = ? AND profile_id = ?', [
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
  const rows = await db.getAllAsync<{ date: string }>(
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
  const rows = await db.getAllAsync<Record<string, unknown>>(
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
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.profile_id = ?
      AND d.status = 'pending'
      AND d.scheduled_time > datetime('now')
      AND (d.notification_id IS NULL OR d.notification_id = '')
    ORDER BY d.scheduled_time ASC
  `,
    [profileId]
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
  const rows = await db.getAllAsync<{ date: string; total: number; taken: number }>(
    `
    SELECT
      date(scheduled_time) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
    FROM doses
    WHERE profile_id = ?
      AND date(scheduled_time) >= date('now', '-6 days')
      AND date(scheduled_time) <= date('now')
    GROUP BY date(scheduled_time)
    ORDER BY date ASC
  `,
    [profileId]
  );
  return rows.map(r => ({ ...r, rate: r.total > 0 ? r.taken / r.total : 0 }));
}

export async function getAdherenceStreak(): Promise<number> {
  const profileId = requireActiveProfileId();
  const rows = await db.getAllAsync<{ date: string; total: number; taken: number }>(
    `
    SELECT
      date(scheduled_time) as date,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
    FROM doses
    WHERE profile_id = ?
      AND date(scheduled_time) < date('now')
      AND status != 'pending'
    GROUP BY date(scheduled_time)
    ORDER BY date DESC
    LIMIT 90
  `,
    [profileId]
  );

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - (i + 1));
    const expectedStr = expected.toISOString().slice(0, 10);
    const row = rows[i];
    if (row.date !== expectedStr) break;
    if (row.total > 0 && row.taken / row.total >= 0.8) streak++;
    else break;
  }
  return streak;
}

export async function getRecentHistory(limit = 50): Promise<Dose[]> {
  const profileId = requireActiveProfileId();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT d.*, m.name as medicine_name, m.type as medicine_type, m.photo_uri as medicine_photo_uri, s.dosage
    FROM doses d
    JOIN medicines m ON d.medicine_id = m.id
    JOIN schedules s ON d.schedule_id = s.id
    WHERE d.profile_id = ?
      AND d.status != 'pending'
      AND date(d.scheduled_time) <= date('now')
    ORDER BY d.scheduled_time DESC
    LIMIT ?
  `,
    [profileId, limit]
  );
  return rows.map(rowToDose);
}

// --- Dose Generation ---

function buildIntervalDates(config: FrequencyConfig, genStart: Date, finalEnd: Date): Date[] {
  if (!config.intervalHours) return [];
  const intervalMs = config.intervalHours * 3_600_000;
  const [h, m] = config.times[0].split(':').map(Number);
  let current = new Date(genStart);
  current.setHours(h, m, 0, 0);
  if (current < genStart) {
    const elapsed = Math.ceil((genStart.getTime() - current.getTime()) / intervalMs);
    current = new Date(current.getTime() + elapsed * intervalMs);
  }
  const dates: Date[] = [];
  while (current <= finalEnd) {
    dates.push(new Date(current));
    current = new Date(current.getTime() + intervalMs);
  }
  return dates;
}

function buildSpecificDaysDates(config: FrequencyConfig, genStart: Date, finalEnd: Date): Date[] {
  if (!config.specificDays) return [];
  const dates: Date[] = [];
  let current = new Date(genStart);
  current.setHours(0, 0, 0, 0);
  while (current <= finalEnd) {
    if (config.specificDays.includes(current.getDay())) {
      for (const time of config.times) {
        const [h, m] = time.split(':').map(Number);
        const d = new Date(current);
        d.setHours(h, m, 0, 0);
        if (d >= genStart) dates.push(d);
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function buildFixedCycleDates(
  config: FrequencyConfig,
  genStart: Date,
  finalEnd: Date,
  startDate: Date
): Date[] {
  if (!config.daysOn || !config.daysOff) return [];
  const cycleLen = config.daysOn + config.daysOff;
  const msPerDay = 24 * 3_600_000;
  const daysSinceStart = Math.floor((genStart.getTime() - startDate.getTime()) / msPerDay);
  let current = new Date(genStart);
  current.setHours(0, 0, 0, 0);
  let dayIndex = daysSinceStart;
  const dates: Date[] = [];
  while (current <= finalEnd) {
    const posInCycle = ((dayIndex % cycleLen) + cycleLen) % cycleLen;
    if (posInCycle < config.daysOn) {
      for (const time of config.times) {
        const [h, m] = time.split(':').map(Number);
        const d = new Date(current);
        d.setHours(h, m, 0, 0);
        if (d >= genStart) dates.push(d);
      }
    }
    current.setDate(current.getDate() + 1);
    dayIndex++;
  }
  return dates;
}

export async function generateDosesForSchedule(schedule: Schedule, daysAhead = 30) {
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

// --- Cycle realignment ---

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

// --- Helpers ---

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// --- Stock projections ---

function dailyConsumptionFromConfig(cfg: FrequencyConfig, doseQuantity: number): number {
  if (cfg.type === 'interval_hours' && cfg.intervalHours) {
    return (24 / cfg.intervalHours) * doseQuantity;
  }
  if (cfg.type === 'specific_days' && cfg.specificDays) {
    return (cfg.specificDays.length / 7) * cfg.times.length * doseQuantity;
  }
  if (cfg.type === 'fixed_cycle' && cfg.daysOn && cfg.daysOff) {
    return (cfg.daysOn / (cfg.daysOn + cfg.daysOff)) * cfg.times.length * doseQuantity;
  }
  return 0;
}

export async function getStockProjections(): Promise<Record<number, StockProjection>> {
  const profileId = requireActiveProfileId();
  const rows = await db.getAllAsync<{
    medicine_id: number;
    dose_quantity: number;
    frequency_config: string;
    stock_quantity: number;
  }>(
    `SELECT s.medicine_id, s.dose_quantity, s.frequency_config, m.stock_quantity
     FROM schedules s
     JOIN medicines m ON s.medicine_id = m.id
     WHERE s.profile_id = ? AND s.is_active = 1`,
    [profileId]
  );

  const byMedicine: Record<number, { stockQuantity: number; dailyConsumption: number }> = {};
  for (const row of rows) {
    const cfg = JSON.parse(row.frequency_config) as FrequencyConfig;
    const daily = dailyConsumptionFromConfig(cfg, row.dose_quantity ?? 1);
    if (!byMedicine[row.medicine_id]) {
      byMedicine[row.medicine_id] = { stockQuantity: row.stock_quantity, dailyConsumption: 0 };
    }
    byMedicine[row.medicine_id].dailyConsumption += daily;
  }

  const result: Record<number, StockProjection> = {};
  for (const [idStr, data] of Object.entries(byMedicine)) {
    const id = Number(idStr);
    if (data.dailyConsumption === 0 || data.stockQuantity <= 0) {
      result[id] = {
        dailyConsumption: data.dailyConsumption,
        daysRemaining: null,
        estimatedEndDate: null,
      };
    } else {
      const daysRemaining = Math.floor(data.stockQuantity / data.dailyConsumption);
      const end = new Date();
      end.setDate(end.getDate() + daysRemaining);
      result[id] = {
        dailyConsumption: data.dailyConsumption,
        daysRemaining,
        estimatedEndDate: end.toISOString().slice(0, 10),
      };
    }
  }
  return result;
}

// --- Row mappers ---

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
  };
}

function rowToMedicine(row: Record<string, unknown>): Medicine {
  return {
    id: row.id as number,
    profileId: row.profile_id as number,
    name: row.name as string,
    type: row.type as MedicineType,
    stockQuantity: row.stock_quantity as number,
    stockUnit: row.stock_unit as string,
    photoUri: (row.photo_uri as string | null) ?? undefined,
    lowStockThreshold: row.low_stock_threshold as number,
    createdAt: row.created_at as string,
  };
}

function rowToSchedule(row: Record<string, unknown>): Schedule {
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
