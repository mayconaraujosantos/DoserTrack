import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  medicines: {
    all: ['medicines'] as const,
    detail: (id: number) => ['medicines', 'detail', id] as const,
  },
  doses: {
    all: ['doses'] as const,
    day: (date: string) => ['doses', 'day', date] as const,
    range: (start: string, end: string) => ['doses', 'range', start, end] as const,
    detail: (id: number) => ['doses', 'detail', id] as const,
    calendar: (year: number, month: number) => ['doses', 'calendar', year, month] as const,
  },
  schedules: {
    all: ['schedules'] as const,
  },
  stockProjections: ['stock-projections'] as const,
  adherence: {
    all: ['adherence'] as const,
    week: ['adherence', 'week'] as const,
    streak: ['adherence', 'streak'] as const,
  },
  history: ['history'] as const,
};

/**
 * Invalida tudo que é "dado de acompanhamento" de uma vez (doses,
 * medicamentos, agendamentos, projeção de estoque, adesão, histórico).
 * Usada por toda mutation que mexe em dose/medicamento/agendamento, em vez
 * de cada uma escolher manualmente o que invalidar — isso já causou
 * inconsistências (mutations que decrementam estoque sem invalidar
 * medicamentos, por exemplo).
 */
export function invalidateTrackingQueries(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.doses.all });
  qc.invalidateQueries({ queryKey: queryKeys.medicines.all });
  qc.invalidateQueries({ queryKey: queryKeys.schedules.all });
  qc.invalidateQueries({ queryKey: queryKeys.stockProjections });
  qc.invalidateQueries({ queryKey: queryKeys.adherence.all });
  qc.invalidateQueries({ queryKey: queryKeys.history });
}
