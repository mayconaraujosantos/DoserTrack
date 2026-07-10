import { getFirstRow, runQuery } from './raw-query';

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
