/**
 * Suíte de integração: exercita generateDosesForSchedule, getDosesForDateRange,
 * updateDoseStatus e regenerateFutureDosesForSchedule juntos, contra um SQLite
 * real (node:sqlite em memória) — sem mockar `@/lib/database`. O único ponto
 * trocado é o driver nativo (`expo-sqlite`), substituído pelo `node:sqlite`
 * que o próprio Node já traz, mantendo o mesmo dialeto SQL do app.
 */
import {
  createMedicine,
  createSchedule,
  generateDosesForSchedule,
  getDosesForDateRange,
  getMedicineById,
  initDatabase,
  regenerateFutureDosesForSchedule,
  setActiveProfileId,
  updateDoseStatus,
  updateSchedule,
} from '@/lib/database';
import type { Medicine, Schedule } from '@/types';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync: NodeDatabaseSync } = require('node:sqlite');
    const raw = new NodeDatabaseSync(':memory:');
    return {
      execAsync: async (sql: string) => {
        raw.exec(sql);
      },
      getAllAsync: async (sql: string, params?: unknown[]) =>
        raw.prepare(sql).all(...(params ?? [])),
      getFirstAsync: async (sql: string, params?: unknown[]) =>
        raw.prepare(sql).get(...(params ?? [])) ?? null,
      runAsync: async (sql: string, params?: unknown[]) => {
        const result = raw.prepare(sql).run(...(params ?? []));
        return { lastInsertRowId: Number(result.lastInsertRowid), changes: result.changes };
      },
    };
  }),
}));

jest.mock('@/lib/widget-bridge', () => ({
  updateWidgetData: jest.fn(() => Promise.resolve()),
}));

const NOW = '2026-07-07T00:30:00'; // terça-feira, bem antes do primeiro horário (08:00)

async function seedSchedule(): Promise<{ medicine: Medicine; schedule: Schedule }> {
  await initDatabase();
  setActiveProfileId(1);

  const medicine = await createMedicine({
    name: 'Amoxicilina',
    type: 'tablet',
    stockQuantity: 100,
    stockUnit: 'comprimidos',
    lowStockThreshold: 5,
  });

  const schedule = await createSchedule({
    medicineId: medicine.id,
    dosage: '1 comprimido',
    doseQuantity: 2,
    frequencyConfig: {
      type: 'specific_days',
      specificDays: [0, 1, 2, 3, 4, 5, 6],
      times: ['08:00'],
    },
    startDate: '2026-07-01',
    isActive: true,
  });

  return { medicine, schedule };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(NOW));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('fluxo de geração de doses (SQLite real via node:sqlite)', () => {
  it('gera uma dose por dia para os próximos 30 dias, sem duplicar ao rodar de novo', async () => {
    const { schedule } = await seedSchedule();

    await generateDosesForSchedule(schedule);
    const firstRun = await getDosesForDateRange('2026-07-01', '2026-08-31');

    expect(firstRun).toHaveLength(31);
    expect(firstRun[0].scheduledTime).toBe('2026-07-07T08:00:00');
    expect(firstRun[30].scheduledTime).toBe('2026-08-06T08:00:00');
    expect(firstRun.every(d => d.status === 'pending')).toBe(true);

    await generateDosesForSchedule(schedule);
    const secondRun = await getDosesForDateRange('2026-07-01', '2026-08-31');
    expect(secondRun).toHaveLength(31);
  });

  it('marcar uma dose como tomada decrementa o estoque real do medicamento, e desfazer devolve', async () => {
    const { medicine, schedule } = await seedSchedule();
    await generateDosesForSchedule(schedule);
    const [firstDose] = await getDosesForDateRange('2026-07-01', '2026-08-31');

    await updateDoseStatus(firstDose.id, 'taken', firstDose.scheduledTime);
    expect((await getMedicineById(medicine.id))?.stockQuantity).toBe(98);

    await updateDoseStatus(firstDose.id, 'pending');
    expect((await getMedicineById(medicine.id))?.stockQuantity).toBe(100);
  });

  it('regenerar após editar o schedule substitui as doses pendentes mas preserva as já tomadas', async () => {
    const { schedule } = await seedSchedule();
    await generateDosesForSchedule(schedule);
    const [firstDose] = await getDosesForDateRange('2026-07-01', '2026-08-31');
    await updateDoseStatus(firstDose.id, 'taken', firstDose.scheduledTime);

    const edited = await updateSchedule(schedule.id, {
      dosage: schedule.dosage,
      doseQuantity: schedule.doseQuantity,
      frequencyConfig: { ...schedule.frequencyConfig, times: ['09:00'] },
      startDate: schedule.startDate,
      endDate: schedule.endDate,
    });
    await regenerateFutureDosesForSchedule(edited);

    const doses = await getDosesForDateRange('2026-07-01', '2026-08-31');
    expect(doses).toHaveLength(32); // 1 tomada (08:00) preservada + 31 novas (09:00)

    const taken = doses.filter(d => d.status === 'taken');
    const pending = doses.filter(d => d.status === 'pending');
    expect(taken).toHaveLength(1);
    expect(taken[0].scheduledTime).toBe('2026-07-07T08:00:00');
    expect(pending).toHaveLength(31);
    expect(pending.every(d => d.scheduledTime.endsWith('T09:00:00'))).toBe(true);
  });
});
