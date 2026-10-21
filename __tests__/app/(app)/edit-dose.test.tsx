import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import EditDoseScreen from '@/app/(app)/edit-dose';
import { useDose } from '@/hooks/use-doses';
import {
  getDosesForDate,
  realignIntervalSchedule,
  updateDoseNotificationId,
  updateDoseScheduleTime,
  updateDoseStatus,
} from '@/lib/database';
import { scheduleDoseNotification } from '@/lib/notifications';
import type { Dose } from '@/types';

jest.mock('@/hooks/use-doses', () => ({
  useDose: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  getDosesForDate: jest.fn(),
  realignIntervalSchedule: jest.fn(),
  updateDoseNotificationId: jest.fn(),
  updateDoseScheduleTime: jest.fn(),
  updateDoseStatus: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  scheduleDoseNotification: jest.fn(),
}));

const mockUseDose = useDose as jest.Mock;
const mockGetDosesForDate = getDosesForDate as jest.Mock;
const mockRealignIntervalSchedule = realignIntervalSchedule as jest.Mock;
const mockUpdateDoseNotificationId = updateDoseNotificationId as jest.Mock;
const mockUpdateDoseScheduleTime = updateDoseScheduleTime as jest.Mock;
const mockUpdateDoseStatus = updateDoseStatus as jest.Mock;
const mockScheduleDoseNotification = scheduleDoseNotification as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const baseDose: Dose = {
  id: 5,
  profileId: 1,
  scheduleId: 2,
  medicineId: 3,
  medicineName: 'Vitamina D',
  dosage: '1 cápsula',
  scheduledTime: '2026-07-14T08:00:00',
  status: 'pending',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditDoseScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T08:00:00'));
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '5' });
  mockUseDose.mockReturnValue({ data: baseDose, isLoading: false });
  mockUpdateDoseStatus.mockResolvedValue(undefined);
  mockUpdateDoseScheduleTime.mockResolvedValue(undefined);
  mockRealignIntervalSchedule.mockResolvedValue(undefined);
  mockGetDosesForDate.mockResolvedValue([]);
  mockUpdateDoseNotificationId.mockResolvedValue(undefined);
  mockScheduleDoseNotification.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('EditDoseScreen', () => {
  it('mostra indicador de carregamento enquanto a dose não chega', () => {
    mockUseDose.mockReturnValue({ data: undefined, isLoading: true });
    renderScreen();
    expect(screen.queryByLabelText('Salvar alteração')).toBeNull();
  });

  it('renderiza os dados da dose carregada', () => {
    renderScreen();
    expect(screen.getByText('Vitamina D')).toBeTruthy();
    expect(screen.getByText('1 cápsula')).toBeTruthy();
  });

  it('salvar com o status padrão (pendente) chama updateDoseScheduleTime', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Salvar alteração'));

    await waitFor(() => {
      expect(mockUpdateDoseScheduleTime).toHaveBeenCalledWith(5, expect.any(String), 'pending');
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('marcar como "Tomado" sem desvio de horário atualiza o status sem realinhar', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Tomado'));
    fireEvent.press(screen.getByLabelText('Salvar alteração'));

    await waitFor(() => {
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(5, 'taken', expect.any(String));
      expect(mockRouter.back).toHaveBeenCalled();
    });
    expect(mockRealignIntervalSchedule).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('marcar como "Tomado" com desvio grande de horário realinha e confirma via alerta', async () => {
    jest.setSystemTime(new Date('2026-07-14T08:25:00'));
    renderScreen();
    fireEvent.press(screen.getByLabelText('Tomado'));
    fireEvent.press(screen.getByLabelText('Salvar alteração'));

    await waitFor(() => {
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(5, 'taken', expect.any(String));
      expect(mockRealignIntervalSchedule).toHaveBeenCalledWith(2, expect.any(String));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Horários realinhados',
        expect.any(String),
        expect.any(Array)
      );
    });

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    alertCall[2][0].onPress();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('marcar como "Pulado" e preencher motivo envia o skipReason', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Pulado'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Ex: Esqueci, estava dormindo...'),
      'Estava viajando'
    );
    fireEvent.press(screen.getByLabelText('Salvar alteração'));

    await waitFor(() => {
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(5, 'skipped', undefined, 'Estava viajando');
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('erro ao salvar exibe alerta e não navega', async () => {
    mockUpdateDoseScheduleTime.mockRejectedValueOnce(new Error('Falha ao salvar'));
    renderScreen();
    fireEvent.press(screen.getByLabelText('Salvar alteração'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao salvar');
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
