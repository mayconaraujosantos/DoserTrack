import type { FrequencyConfig, FrequencyType } from '@/types';

interface FrequencyStrategy {
  buildDates(config: FrequencyConfig, genStart: Date, finalEnd: Date, startDate: Date): Date[];
  dailyConsumption(config: FrequencyConfig, doseQuantity: number): number;
}

const intervalHoursStrategy: FrequencyStrategy = {
  buildDates(config, genStart, finalEnd) {
    if (!config.intervalHours) return [];
    const intervalMs = config.intervalHours * 3_600_000;
    const [h, m] = config.times[0].split(':').map(Number);
    let current = new Date(genStart);
    current.setHours(h, m, 0, 0);
    if (current < genStart) {
      const elapsed = Math.ceil((genStart.getTime() - current.getTime()) / intervalMs);
      current = new Date(current.getTime() + elapsed * intervalMs);
    }
    const dates: Date[] = [];
    while (current <= finalEnd) {
      dates.push(new Date(current));
      current = new Date(current.getTime() + intervalMs);
    }
    return dates;
  },
  dailyConsumption(config, doseQuantity) {
    if (!config.intervalHours) return 0;
    return (24 / config.intervalHours) * doseQuantity;
  },
};

const specificDaysStrategy: FrequencyStrategy = {
  buildDates(config, genStart, finalEnd) {
    if (!config.specificDays) return [];
    const dates: Date[] = [];
    let current = new Date(genStart);
    current.setHours(0, 0, 0, 0);
    while (current <= finalEnd) {
      if (config.specificDays.includes(current.getDay())) {
        for (const time of config.times) {
          const [h, m] = time.split(':').map(Number);
          const d = new Date(current);
          d.setHours(h, m, 0, 0);
          if (d >= genStart) dates.push(d);
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  },
  dailyConsumption(config, doseQuantity) {
    if (!config.specificDays) return 0;
    return (config.specificDays.length / 7) * config.times.length * doseQuantity;
  },
};

const fixedCycleStrategy: FrequencyStrategy = {
  buildDates(config, genStart, finalEnd, startDate) {
    if (!config.daysOn || !config.daysOff) return [];
    const cycleLen = config.daysOn + config.daysOff;
    const msPerDay = 24 * 3_600_000;
    const daysSinceStart = Math.floor((genStart.getTime() - startDate.getTime()) / msPerDay);
    let current = new Date(genStart);
    current.setHours(0, 0, 0, 0);
    let dayIndex = daysSinceStart;
    const dates: Date[] = [];
    while (current <= finalEnd) {
      const posInCycle = ((dayIndex % cycleLen) + cycleLen) % cycleLen;
      if (posInCycle < config.daysOn) {
        for (const time of config.times) {
          const [h, m] = time.split(':').map(Number);
          const d = new Date(current);
          d.setHours(h, m, 0, 0);
          if (d >= genStart) dates.push(d);
        }
      }
      current.setDate(current.getDate() + 1);
      dayIndex++;
    }
    return dates;
  },
  dailyConsumption(config, doseQuantity) {
    if (!config.daysOn || !config.daysOff) return 0;
    return (config.daysOn / (config.daysOn + config.daysOff)) * config.times.length * doseQuantity;
  },
};

const strategies: Record<FrequencyType, FrequencyStrategy> = {
  interval_hours: intervalHoursStrategy,
  specific_days: specificDaysStrategy,
  fixed_cycle: fixedCycleStrategy,
};

export function getFrequencyStrategy(type: FrequencyType): FrequencyStrategy {
  return strategies[type];
}
