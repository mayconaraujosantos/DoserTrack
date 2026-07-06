import { getFrequencyStrategy } from '@/lib/frequency-strategy';
import type { FrequencyConfig } from '@/types';

describe('interval_hours strategy', () => {
  const strategy = getFrequencyStrategy('interval_hours');

  it('gera doses a cada N horas a partir do horário-âncora', () => {
    const config: FrequencyConfig = { type: 'interval_hours', intervalHours: 8, times: ['08:00'] };
    const genStart = new Date('2026-01-01T00:00:00');
    const finalEnd = new Date('2026-01-01T23:59:59');

    const dates = strategy.buildDates(config, genStart, finalEnd, genStart);

    expect(dates.map(d => d.getHours())).toEqual([8, 16]);
  });

  it('calcula consumo diário como 24/intervalHours * doseQuantity', () => {
    const config: FrequencyConfig = { type: 'interval_hours', intervalHours: 8, times: ['08:00'] };
    expect(strategy.dailyConsumption(config, 2)).toBe(6);
  });

  it('retorna vazio/zero quando intervalHours não está definido', () => {
    const config: FrequencyConfig = { type: 'interval_hours', times: ['08:00'] };
    expect(strategy.buildDates(config, new Date(), new Date(), new Date())).toEqual([]);
    expect(strategy.dailyConsumption(config, 1)).toBe(0);
  });
});

describe('specific_days strategy', () => {
  const strategy = getFrequencyStrategy('specific_days');

  it('gera doses só nos dias da semana configurados', () => {
    // 2026-01-01 é uma quinta-feira (getDay() === 4); janela cobre 2 quintas (01 e 08)
    const config: FrequencyConfig = {
      type: 'specific_days',
      specificDays: [4],
      times: ['08:00'],
    };
    const genStart = new Date('2026-01-01T00:00:00');
    const finalEnd = new Date('2026-01-08T23:59:59');

    const dates = strategy.buildDates(config, genStart, finalEnd, genStart);

    expect(dates).toHaveLength(2);
    expect(dates.every(d => d.getDay() === 4)).toBe(true);
  });

  it('calcula consumo diário como (dias/7) * times.length * doseQuantity', () => {
    const config: FrequencyConfig = {
      type: 'specific_days',
      specificDays: [1, 3, 5],
      times: ['08:00'],
    };
    expect(strategy.dailyConsumption(config, 2)).toBeCloseTo((3 / 7) * 1 * 2);
  });
});

describe('fixed_cycle strategy', () => {
  const strategy = getFrequencyStrategy('fixed_cycle');

  it('gera doses só nos dias "on" do ciclo', () => {
    const startDate = new Date('2026-01-01T00:00:00');
    const config: FrequencyConfig = {
      type: 'fixed_cycle',
      daysOn: 2,
      daysOff: 2,
      times: ['08:00'],
    };
    const finalEnd = new Date('2026-01-04T23:59:59');

    const dates = strategy.buildDates(config, startDate, finalEnd, startDate);

    // ciclo de 4 dias (2 on, 2 off) a partir de 01/01: on, on, off, off
    expect(dates.map(d => d.getDate())).toEqual([1, 2]);
  });

  it('calcula consumo diário como (daysOn/(daysOn+daysOff)) * times.length * doseQuantity', () => {
    const config: FrequencyConfig = {
      type: 'fixed_cycle',
      daysOn: 2,
      daysOff: 2,
      times: ['08:00'],
    };
    expect(strategy.dailyConsumption(config, 1)).toBe(0.5);
  });
});
