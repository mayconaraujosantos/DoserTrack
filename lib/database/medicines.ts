import type { Medicine, MedicineType } from '@/types';
import { getDb, requireActiveProfileId } from './connection';

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

export async function getMedicines(): Promise<Medicine[]> {
  const profileId = requireActiveProfileId();
  const rows = await getDb().getAllAsync<Record<string, unknown>>(
    'SELECT * FROM medicines WHERE profile_id = ? ORDER BY name',
    [profileId]
  );
  return rows.map(rowToMedicine);
}

export async function getMedicineById(id: number): Promise<Medicine | null> {
  const profileId = requireActiveProfileId();
  const row = await getDb().getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM medicines WHERE id = ? AND profile_id = ?',
    [id, profileId]
  );
  return row ? rowToMedicine(row) : null;
}

export async function createMedicine(
  data: Omit<Medicine, 'id' | 'createdAt' | 'profileId'>
): Promise<Medicine> {
  const profileId = requireActiveProfileId();
  const result = await getDb().runAsync(
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
  await getDb().runAsync(
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
  await getDb().runAsync(
    'UPDATE medicines SET stock_quantity = ? WHERE id = ? AND profile_id = ?',
    [newQuantity, id, profileId]
  );
}

export async function deleteMedicine(id: number) {
  const profileId = requireActiveProfileId();
  await getDb().runAsync('DELETE FROM medicines WHERE id = ? AND profile_id = ?', [id, profileId]);
}
