import type * as SQLite from 'expo-sqlite';
import { getDb } from './connection';

export async function getAllRows<T = Record<string, unknown>>(
  sql: string,
  params?: SQLite.SQLiteBindParams
): Promise<T[]> {
  if (params === undefined) {
    return getDb().getAllAsync<T>(sql);
  }
  return getDb().getAllAsync<T>(sql, params);
}

export async function getFirstRow<T = Record<string, unknown>>(
  sql: string,
  params?: SQLite.SQLiteBindParams
): Promise<T | null> {
  if (params === undefined) {
    return getDb().getFirstAsync<T>(sql);
  }
  const row = await getDb().getFirstAsync<T>(sql, params);
  return row ?? null;
}

export async function runQuery(
  sql: string,
  params?: SQLite.SQLiteBindParams
): Promise<SQLite.SQLiteRunResult> {
  if (params === undefined) {
    return getDb().runAsync(sql);
  }
  return getDb().runAsync(sql, params);
}
