import { DOSE_STATUS_LABEL, getDisplayStatus, isOverdue } from '@/lib/dose-status';
import type { Dose } from '@/types';

const now = new Date('2026-07-07T10:00:00');

function makeDose(overrides: Partial<Dose>): Dose {
  return {
    id: 1,
    profileId: 1,
    scheduleId: 1,
    medicineId: 1,
    scheduledTime: '2026-07-07T08:00:00',
    status: 'pending',
    ...overrides,
  };
}

describe('getDisplayStatus', () => {
  it('retorna "taken" quando a dose foi tomada, mesmo se o horário já passou', () => {
    const dose = makeDose({ status: 'taken', scheduledTime: '2026-07-07T08:00:00' });
    expect(getDisplayStatus(dose, now)).toBe('taken');
  });

  it('retorna "skipped" quando a dose foi pulada', () => {
    const dose = makeDose({ status: 'skipped', scheduledTime: '2026-07-07T08:00:00' });
    expect(getDisplayStatus(dose, now)).toBe('skipped');
  });

  it('retorna "snoozed" para dose adiada, mesmo com horário já passado', () => {
    const dose = makeDose({ status: 'snoozed', scheduledTime: '2026-07-07T08:00:00' });
    expect(getDisplayStatus(dose, now)).toBe('snoozed');
  });

  it('retorna "late" para dose pendente com horário já passado', () => {
    const dose = makeDose({ status: 'pending', scheduledTime: '2026-07-07T08:00:00' });
    expect(getDisplayStatus(dose, now)).toBe('late');
  });

  it('retorna "pending" para dose pendente com horário futuro', () => {
    const dose = makeDose({ status: 'pending', scheduledTime: '2026-07-07T15:00:00' });
    expect(getDisplayStatus(dose, now)).toBe('pending');
  });
});

describe('isOverdue', () => {
  it('é true apenas quando o display status é "late"', () => {
    expect(
      isOverdue(makeDose({ status: 'pending', scheduledTime: '2026-07-07T08:00:00' }), now)
    ).toBe(true);
  });

  it('é false para dose adiada com horário já passado', () => {
    expect(
      isOverdue(makeDose({ status: 'snoozed', scheduledTime: '2026-07-07T08:00:00' }), now)
    ).toBe(false);
  });

  it('é false para dose tomada ou pulada', () => {
    expect(
      isOverdue(makeDose({ status: 'taken', scheduledTime: '2026-07-07T08:00:00' }), now)
    ).toBe(false);
    expect(
      isOverdue(makeDose({ status: 'skipped', scheduledTime: '2026-07-07T08:00:00' }), now)
    ).toBe(false);
  });

  it('é false para dose pendente com horário futuro', () => {
    expect(
      isOverdue(makeDose({ status: 'pending', scheduledTime: '2026-07-07T15:00:00' }), now)
    ).toBe(false);
  });
});

describe('DOSE_STATUS_LABEL', () => {
  it('tem um rótulo em português para cada status possível', () => {
    expect(DOSE_STATUS_LABEL).toEqual({
      taken: 'Tomado',
      late: 'Atrasado',
      pending: 'Pendente',
      snoozed: 'Adiado',
      skipped: 'Pulado',
    });
  });
});
