import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ReminderAlertScreen from '@/app/(app)/reminder-alert';
import { useDose } from '@/hooks/use-doses';
import { updateDoseStatus } from '@/lib/database';
import { scheduleSnoozeNotification, cancelNotification } from '@/lib/notifications';
import { haptic } from '@/lib/haptics';
import type { Dose } from '@/types';

jest.mock('@/hooks/use-doses', () => ({
  useDose: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  updateDoseStatus: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  scheduleSnoozeNotification: jest.fn(),
  cancelNotification: jest.fn(),
}));

jest.mock('@/lib/haptics', () => ({
  haptic: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
  },
}));

const mockUseDose = useDose as jest.Mock;
const mockUpdateDoseStatus = updateDoseStatus as jest.Mock;
const mockScheduleSnoozeNotification = scheduleSnoozeNotification as jest.Mock;
const mockCancelNotification = cancelNotification as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const baseDose: Dose = {
  id: 1,
  profileId: 1,
  scheduleId: 2,
  medicineId: 3,
  medicineName: 'Dipirona',
  dosage: '1 comprimido',
  scheduledTime: '2026-07-14T08:00:00',
  status: 'pending',
  notificationId: 'notif-1',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReminderAlertScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ doseId: '1' });
  mockUseDose.mockReturnValue({ data: baseDose, isLoading: false });
  mockUpdateDoseStatus.mockResolvedValue(undefined);
  mockCancelNotification.mockResolvedValue(undefined);
  mockScheduleSnoozeNotification.mockResolvedValue(undefined);
});

describe('ReminderAlertScreen', () => {
  it('mostra indicador de carregamento enquanto a dose não chega', () => {
    mockUseDose.mockReturnValue({ data: undefined, isLoading: true });
    renderScreen();
    expect(screen.queryByText('Hora do remédio!')).toBeNull();
  });

  it('renderiza as informações da dose', () => {
    renderScreen();
    expect(screen.getByText('Hora do remédio!')).toBeTruthy();
    expect(screen.getByText('Dipirona')).toBeTruthy();
    expect(screen.getByText('1 comprimido')).toBeTruthy();
  });

  it('tomar agora cancela a notificação, atualiza o status e volta', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Tomar medicamento agora'));

    await waitFor(() => {
      expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(1, 'taken', expect.any(String));
      expect(haptic.success).toHaveBeenCalled();
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('pular dose exige confirmação e depois registra o motivo', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Pular dose'));

    expect(screen.getByPlaceholderText('Motivo (opcional)...')).toBeTruthy();
    expect(mockUpdateDoseStatus).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('Motivo (opcional)...'), 'Esqueci');
    fireEvent.press(screen.getByText('Confirmar pulo'));

    await waitFor(() => {
      expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(1, 'skipped', undefined, 'Esqueci');
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('cancelar o motivo do pulo esconde o formulário sem registrar nada', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Pular dose'));
    fireEvent.press(screen.getByText('Cancelar'));

    expect(screen.queryByPlaceholderText('Motivo (opcional)...')).toBeNull();
    expect(screen.getByLabelText('Pular dose')).toBeTruthy();
    expect(mockUpdateDoseStatus).not.toHaveBeenCalled();
  });

  it('adiar com a opção padrão (10 min) agenda a notificação de soneca', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Confirmar adiamento de 10 minutos'));

    await waitFor(() => {
      expect(mockCancelNotification).toHaveBeenCalledWith('notif-1');
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(1, 'snoozed');
      expect(mockScheduleSnoozeNotification).toHaveBeenCalledWith(
        { id: 1, medicineName: 'Dipirona', dosage: '1 comprimido' },
        10
      );
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('selecionar outra opção de soneca (5 min) agenda com o valor escolhido', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Adiar 5 min'));
    fireEvent.press(screen.getByLabelText('Confirmar adiamento de 5 minutos'));

    await waitFor(() => {
      expect(mockScheduleSnoozeNotification).toHaveBeenCalledWith(expect.any(Object), 5);
    });
  });
});
