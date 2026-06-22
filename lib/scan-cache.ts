import * as SQLite from 'expo-sqlite';
import type { PrescriptionData } from '@/lib/prescription-scanner';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// djb2 hash sobre uma amostra da imagem — rápido e determinístico
function fingerprint(base64: string): string {
  const sample = `${base64.length}|${base64.slice(0, 300)}|${base64.slice(-100)}`;
  let hash = 5381;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash * 33) ^ sample.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

async function getDb() {
  const db = await SQLite.openDatabaseAsync('doser.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prescription_cache (
      hash TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  return db;
}

export async function getCachedPrescription(base64: string): Promise<PrescriptionData[] | null> {
  const db = await getDb();
  const hash = fingerprint(base64);
  const cutoff = Date.now() - CACHE_TTL_MS;
  const row = await db.getFirstAsync<{ result_json: string }>(
    'SELECT result_json FROM prescription_cache WHERE hash = ? AND created_at > ?',
    [hash, cutoff]
  );
  if (!row) return null;
  return JSON.parse(row.result_json) as PrescriptionData[];
}

export async function cachePrescription(base64: string, result: PrescriptionData[]): Promise<void> {
  const db = await getDb();
  const hash = fingerprint(base64);
  await db.runAsync(
    'INSERT OR REPLACE INTO prescription_cache (hash, result_json, created_at) VALUES (?, ?, ?)',
    [hash, JSON.stringify(result), Date.now()]
  );
}

export async function clearPrescriptionCache(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM prescription_cache');
}
