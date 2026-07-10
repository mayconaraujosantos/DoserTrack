import type { FrequencyConfig, StockProjection } from '@/types';
import { getDb, requireActiveProfileId } from './connection';

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
  const rows = await getDb().getAllAsync<{
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
