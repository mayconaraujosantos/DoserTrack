import { invalidateTrackingQueries, queryKeys } from '@/lib/query-keys';
import { QueryClient } from '@tanstack/react-query';

describe('queryKeys', () => {
  it('gera chaves de doses aninhadas sob o prefixo doses.all', () => {
    expect(queryKeys.doses.day('2026-07-07')).toEqual(['doses', 'day', '2026-07-07']);
    expect(queryKeys.doses.range('2026-07-07', '2026-07-13')).toEqual([
      'doses',
      'range',
      '2026-07-07',
      '2026-07-13',
    ]);
    expect(queryKeys.doses.detail(42)).toEqual(['doses', 'detail', 42]);
    expect(queryKeys.doses.calendar(2026, 6)).toEqual(['doses', 'calendar', 2026, 6]);
  });

  it('gera chaves de medicamentos aninhadas sob o prefixo medicines.all', () => {
    expect(queryKeys.medicines.detail(7)).toEqual(['medicines', 'detail', 7]);
  });

  it('gera chaves de adesão aninhadas sob o prefixo adherence.all', () => {
    expect(queryKeys.adherence.week).toEqual(['adherence', 'week']);
    expect(queryKeys.adherence.streak).toEqual(['adherence', 'streak']);
  });
});

describe('invalidateTrackingQueries', () => {
  it('invalida doses, medicines, schedules, stock-projections, adherence e history', () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');

    invalidateTrackingQueries(qc);

    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.doses.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.medicines.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.schedules.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.stockProjections });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.adherence.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.history });
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it('invalidar doses.all cobre chaves aninhadas por prefixo (regressão dos bugs de week-doses/datesWithDoses)', async () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.doses.day('2026-07-07'), []);
    qc.setQueryData(queryKeys.doses.range('2026-07-07', '2026-07-13'), []);
    qc.setQueryData(queryKeys.doses.calendar(2026, 6), new Set());

    await qc.invalidateQueries({ queryKey: queryKeys.doses.all });

    expect(qc.getQueryState(queryKeys.doses.day('2026-07-07'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(queryKeys.doses.range('2026-07-07', '2026-07-13'))?.isInvalidated).toBe(
      true
    );
    expect(qc.getQueryState(queryKeys.doses.calendar(2026, 6))?.isInvalidated).toBe(true);
  });
});
