import {
  buildFixedCycleDates,
  buildIntervalDates,
  buildSpecificDaysDates,
} from '@/lib/database/calendar';
import type { FrequencyConfig } from '@/types';

function iso(dates: Date[]): string[] {
  return dates.map(d => d.toISOString());
}

describe('buildIntervalDates', () => {
  it('alinha a primeira dose ao próximo horário do intervalo a partir de genStart', () => {
    const config: FrequencyConfig = { type: 'interval_hours', intervalHours: 8, times: ['08:00'] };
    const genStart = new Date('2026-07-07T10:00:00');
    const finalEnd = new Date('2026-07-07T23:59:59');

    const dates = buildIntervalDates(config, genStart, finalEnd);

    expect(iso(dates)).toEqual([new Date('2026-07-07T16:00:00').toISOString()]);
  });

  it('retorna array vazio quando intervalHours não está definido', () => {
    const config: FrequencyConfig = { type: 'interval_hours', times: ['08:00'] };
    const dates = buildIntervalDates(
      config,
      new Date('2026-07-07T00:00:00'),
      new Date('2026-07-08T00:00:00')
    );
    expect(dates).toEqual([]);
  });
});

describe('buildSpecificDaysDates', () => {
  it('gera doses apenas nos dias da semana configurados', () => {
    const config: FrequencyConfig = {
      type: 'specific_days',
      specificDays: [1, 3], // segunda, quarta
      times: ['08:00'],
    };
    const genStart = new Date('2026-07-06T00:00:00'); // segunda
    const finalEnd = new Date('2026-07-09T23:59:59'); // até quinta

    const dates = buildSpecificDaysDates(config, genStart, finalEnd);

    expect(iso(dates)).toEqual([
      new Date('2026-07-06T08:00:00').toISOString(),
      new Date('2026-07-08T08:00:00').toISOString(),
    ]);
  });

  it('ignora horários do dia inicial que já passaram de genStart', () => {
    const config: FrequencyConfig = {
      type: 'specific_days',
      specificDays: [1, 3],
      times: ['08:00'],
    };
    const genStart = new Date('2026-07-06T10:00:00'); // segunda, após as 08:00
    const finalEnd = new Date('2026-07-09T23:59:59');

    const dates = buildSpecificDaysDates(config, genStart, finalEnd);

    expect(iso(dates)).toEqual([new Date('2026-07-08T08:00:00').toISOString()]);
  });
});

describe('buildFixedCycleDates', () => {
  it('gera doses só nos dias "on" do ciclo', () => {
    const config: FrequencyConfig = {
      type: 'fixed_cycle',
      daysOn: 2,
      daysOff: 1,
      times: ['08:00'],
    };
    const startDate = new Date('2026-07-06T00:00:00');
    const genStart = new Date('2026-07-06T00:00:00');
    const finalEnd = new Date('2026-07-11T23:59:59');

    const dates = buildFixedCycleDates(config, genStart, finalEnd, startDate);

    expect(iso(dates)).toEqual(
      ['2026-07-06', '2026-07-07', '2026-07-09', '2026-07-10'].map(
        d => new Date(`${d}T08:00:00`).toISOString()
      )
    );
  });
});
