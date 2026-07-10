import {
  generateDosesForSchedule,
  getDosesForDateRange,
  updateDoseNotificationId,
  updateDoseStatus,
} from '@/lib/database';
import { finalizeNewSchedule } from '@/lib/dose-scheduling';
import { scheduleDoseNotification } from '@/lib/notifications';
import type { Dose, Schedule } from '@/types';

jest.mock('@/lib/database', () => ({
  generateDosesForSchedule: jest.fn(),
  getDosesForDateRange: jest.fn(),
  updateDoseNotificationId: jest.fn(),
  updateDoseStatus: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  scheduleDoseNotification: jest.fn(),
}));

const mockGenerate = generateDosesForSchedule as jest.Mock;
const mockGetRange = getDosesForDateRange as jest.Mock;
const mockUpdateNotificationId = updateDoseNotificationId as jest.Mock;
const mockUpdateStatus = updateDoseStatus as jest.Mock;
const mockScheduleNotification = scheduleDoseNotification as jest.Mock;

const baseSchedule: Schedule = {
  id: 1,
  profileId: 1,
  medicineId: 1,
  dosage: '1 comprimido',
  doseQuantity: 1,
  frequencyConfig: { type: 'specific_days', specificDays: [0, 1, 2, 3, 4, 5, 6], times: ['08:00'] },
  startDate: '2026-07-07',
  isActive: true,
  createdAt: '2026-07-07T00:00:00.000Z',
};

function makeDose(overrides: Partial<Dose>): Dose {
  return {
    id: 1,
    profileId: 1,
    scheduleId: baseSchedule.id,
    medicineId: 1,
    scheduledTime: '2026-07-07T15:00:00',
    status: 'pending',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-07T10:00:00'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('finalizeNewSchedule', () => {
  it('gera as doses do schedule antes de qualquer outra coisa', async () => {
    mockGetRange.mockResolvedValueOnce([]);

    await finalizeNewSchedule(baseSchedule, 'Dipirona');

    expect(mockGenerate).toHaveBeenCalledWith(baseSchedule, 30);
  });

  it('agenda notificação e persiste notification_id para doses futuras', async () => {
    const futureDose = makeDose({ id: 10, scheduledTime: '2026-07-07T15:00:00' });
    mockGetRange.mockResolvedValueOnce([futureDose]);
    mockScheduleNotification.mockResolvedValueOnce('notif-abc');

    await finalizeNewSchedule(baseSchedule, 'Dipirona');

    expect(mockScheduleNotification).toHaveBeenCalledWith({
      id: 10,
      medicineName: 'Dipirona',
      dosage: baseSchedule.dosage,
      scheduledTime: futureDose.scheduledTime,
    });
    expect(mockUpdateNotificationId).toHaveBeenCalledWith(10, 'notif-abc');
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('marca como skipped doses de hoje já passadas, sem agendar notificação', async () => {
    const pastDose = makeDose({ id: 11, scheduledTime: '2026-07-07T08:00:00' });
    mockGetRange.mockResolvedValueOnce([pastDose]);

    await finalizeNewSchedule(baseSchedule, 'Dipirona');

    expect(mockUpdateStatus).toHaveBeenCalledWith(11, 'skipped');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
    expect(mockUpdateNotificationId).not.toHaveBeenCalled();
  });

  it('não persiste notification_id quando scheduleDoseNotification retorna null', async () => {
    const futureDose = makeDose({ id: 12, scheduledTime: '2026-07-07T15:00:00' });
    mockGetRange.mockResolvedValueOnce([futureDose]);
    mockScheduleNotification.mockResolvedValueOnce(null);

    await finalizeNewSchedule(baseSchedule, 'Dipirona');

    expect(mockUpdateNotificationId).not.toHaveBeenCalled();
  });

  it('ignora doses de outros schedules retornadas na mesma janela', async () => {
    const otherScheduleDose = makeDose({
      id: 13,
      scheduleId: 999,
      scheduledTime: '2026-07-08T09:00:00',
    });
    mockGetRange.mockResolvedValueOnce([otherScheduleDose]);

    await finalizeNewSchedule(baseSchedule, 'Dipirona');

    expect(mockScheduleNotification).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('consulta getDosesForDateRange com janela de hoje até hoje+6', async () => {
    mockGetRange.mockResolvedValueOnce([]);

    await finalizeNewSchedule(baseSchedule, 'Dipirona');

    expect(mockGetRange).toHaveBeenCalledWith('2026-07-07', '2026-07-13');
  });
});
