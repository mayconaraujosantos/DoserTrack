import type { Dose } from '@/types';

export type DisplayStatus = 'taken' | 'late' | 'pending' | 'snoozed' | 'skipped';

export function getDisplayStatus(dose: Dose, now: Date = new Date()): DisplayStatus {
  if (dose.status === 'taken') return 'taken';
  if (dose.status === 'skipped') return 'skipped';
  if (dose.status === 'snoozed') return 'snoozed';
  if (new Date(dose.scheduledTime) < now) return 'late';
  return 'pending';
}

export function isOverdue(dose: Dose, now: Date = new Date()): boolean {
  return getDisplayStatus(dose, now) === 'late';
}

export const DOSE_STATUS_LABEL: Record<DisplayStatus, string> = {
  taken: 'Tomado',
  late: 'Atrasado',
  pending: 'Pendente',
  snoozed: 'Adiado',
  skipped: 'Pulado',
};
