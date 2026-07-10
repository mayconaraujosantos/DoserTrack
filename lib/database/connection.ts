import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;
let activeProfileId: number | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  return db;
}

export function setDb(instance: SQLite.SQLiteDatabase): void {
  db = instance;
}

export function requireActiveProfileId(): number {
  if (!activeProfileId) {
    throw new Error('Perfil ativo nao configurado.');
  }
  return activeProfileId;
}

export function setActiveProfileId(profileId: number) {
  activeProfileId = profileId;
}

export function getActiveProfileId() {
  return activeProfileId;
}
