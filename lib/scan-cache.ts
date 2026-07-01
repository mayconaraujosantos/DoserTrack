import {
  clearPrescriptionCache as clearPrescriptionCacheTable,
  getCachedPrescriptionByHash,
  setPrescriptionCache,
} from '@/lib/database';
import type { PrescriptionData } from '@/lib/prescription-scanner';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// djb2 hash sobre uma amostra da imagem — rápido e determinístico
function fingerprint(base64: string): string {
  const sample = `${base64.length}|${base64.slice(0, 300)}|${base64.slice(-100)}`;
  let hash = 5381;
  for (let i = 0; i < sample.length; i++) {
    const codePoint = sample.codePointAt(i) ?? 0;
    hash = ((hash * 33) ^ codePoint) >>> 0;
  }
  return hash.toString(36);
}

export async function getCachedPrescription(base64: string): Promise<PrescriptionData[] | null> {
  const hash = fingerprint(base64);
  const cutoff = Date.now() - CACHE_TTL_MS;
  const cacheRow = await getCachedPrescriptionByHash(hash);
  if (!cacheRow) return null;
  if (cacheRow.created_at <= cutoff) return null;
  return JSON.parse(cacheRow.result_json) as PrescriptionData[];
}

export async function cachePrescription(base64: string, result: PrescriptionData[]): Promise<void> {
  const hash = fingerprint(base64);
  await setPrescriptionCache(hash, JSON.stringify(result));
}

export async function clearPrescriptionCache(): Promise<void> {
  await clearPrescriptionCacheTable();
}
