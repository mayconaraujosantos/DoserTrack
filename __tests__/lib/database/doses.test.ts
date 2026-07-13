import { setActiveProfileId, setDb } from '@/lib/database/connection';
import {
  getAdherenceStreak,
  getPendingDosesWithoutNotification,
  getRecentHistory,
  getWeekAdherence,
} from '@/lib/database/doses';
import type * as SQLite from 'expo-sqlite';

function fakeDb(getAllAsync: jest.Mock) {
  return { getAllAsync } as unknown as SQLite.SQLiteDatabase;
}

beforeEach(() => {
  setActiveProfileId(1);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getPendingDosesWithoutNotification', () => {
  it('não usa mais datetime(\'now\') do SQLite (UTC) para comparar com scheduled_time (local)', async () => {
    const mockGetAllAsync = jest.fn().mockResolvedValue([]);
    setDb(fakeDb(mockGetAllAsync));

    await getPendingDosesWithoutNotification();

    const [sql] = mockGetAllAsync.mock.calls[0];
    expect(sql).not.toContain("datetime('now')");
    expect(sql).toContain('d.scheduled_time > ?');
  });

  it('passa o "agora" local (não UTC) formatado igual a scheduled_time como parâmetro', async () => {
    // America/Manaus (UTC-4): 22h locais de 07/07 é 02h UTC de 08/07. O bind
    // param precisa refletir o horário LOCAL, no mesmo formato gravado em
    // scheduled_time (toLocalISOString, sem "Z"/offset), senão a comparação
    // de string mistura fusos e separadores diferentes de novo.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T22:00:00'));
    const mockGetAllAsync = jest.fn().mockResolvedValue([]);
    setDb(fakeDb(mockGetAllAsync));

    await getPendingDosesWithoutNotification();

    const [, params] = mockGetAllAsync.mock.calls[0];
    expect(params).toEqual([1, '2026-07-07T22:00:00']);
  });

  it('mapeia as doses retornadas para o formato Dose', async () => {
    const mockGetAllAsync = jest.fn().mockResolvedValue([
      {
        id: 42,
        profile_id: 1,
        schedule_id: 2,
        medicine_id: 3,
        medicine_name: 'Amoxicilina',
        dosage: '500 mg',
        scheduled_time: '2026-07-08T00:00:00',
        status: 'pending',
        notification_id: null,
      },
    ]);
    setDb(fakeDb(mockGetAllAsync));

    const doses = await getPendingDosesWithoutNotification();

    expect(doses).toEqual([
      expect.objectContaining({
        id: 42,
        medicineName: 'Amoxicilina',
        dosage: '500 mg',
        scheduledTime: '2026-07-08T00:00:00',
        status: 'pending',
      }),
    ]);
  });
});

describe('getWeekAdherence', () => {
  it('não usa mais date(\'now\') do SQLite (UTC); passa hoje e hoje-6 como datas locais', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T22:00:00'));
    const mockGetAllAsync = jest.fn().mockResolvedValue([]);
    setDb(fakeDb(mockGetAllAsync));

    await getWeekAdherence();

    const [sql, params] = mockGetAllAsync.mock.calls[0];
    expect(sql).not.toContain("date('now')");
    expect(params).toEqual([1, '2026-07-01', '2026-07-07']);
  });
});

describe('getAdherenceStreak', () => {
  it('não usa mais date(\'now\') do SQLite (UTC) como limite superior', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T22:00:00'));
    const mockGetAllAsync = jest.fn().mockResolvedValue([]);
    setDb(fakeDb(mockGetAllAsync));

    await getAdherenceStreak();

    const [sql, params] = mockGetAllAsync.mock.calls[0];
    expect(sql).not.toContain("date('now')");
    expect(params).toEqual([1, '2026-07-07']);
  });

  it('compara com a data local esperada (não UTC) ao contar dias consecutivos', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T22:00:00'));
    const mockGetAllAsync = jest.fn().mockResolvedValue([
      { date: '2026-07-06', total: 2, taken: 2 },
      { date: '2026-07-05', total: 2, taken: 2 },
    ]);
    setDb(fakeDb(mockGetAllAsync));

    const streak = await getAdherenceStreak();

    expect(streak).toBe(2);
  });
});

describe('getRecentHistory', () => {
  it('não usa mais date(\'now\') do SQLite (UTC) como limite superior', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T22:00:00'));
    const mockGetAllAsync = jest.fn().mockResolvedValue([]);
    setDb(fakeDb(mockGetAllAsync));

    await getRecentHistory(50);

    const [sql, params] = mockGetAllAsync.mock.calls[0];
    expect(sql).not.toContain("date('now')");
    expect(params).toEqual([1, '2026-07-07', 50]);
  });
});
