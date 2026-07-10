import type { Profile } from '@/types';
import { getDb } from './connection';

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
  };
}

export async function ensureDefaultProfile(): Promise<Profile> {
  const db = getDb();
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

export async function getProfiles(): Promise<Profile[]> {
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM profiles ORDER BY is_default DESC, created_at ASC'
  );
  return rows.map(rowToProfile);
}

export async function getProfileById(id: number): Promise<Profile | null> {
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM profiles WHERE id = ?',
    [id]
  );
  return row ? rowToProfile(row) : null;
}

export async function createProfile(data: { name: string; color?: string }): Promise<Profile> {
  const result = await getDb().runAsync(
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
