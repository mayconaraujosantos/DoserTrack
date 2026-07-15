import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import EditScheduleScreen from '@/app/(app)/edit-schedule';
import { useSchedule } from '@/hooks/use-schedules';
import { deactivateSchedule, updateSchedule } from '@/lib/database';
import { finalizeScheduleUpdate } from '@/lib/dose-scheduling';
import type { Schedule } from '@/types';

jest.mock('@/hooks/use-schedules', () => ({
  useSchedule: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  deactivateSchedule: jest.fn(),
  updateSchedule: jest.fn(),
}));

jest.mock('@/lib/dose-scheduling', () => ({
  finalizeScheduleUpdate: jest.fn(),
}));

const mockUseSchedule = useSchedule as jest.Mock;
const mockDeactivateSchedule = deactivateSchedule as jest.Mock;
const mockUpdateSchedule = updateSchedule as jest.Mock;
const mockFinalizeScheduleUpdate = finalizeScheduleUpdate as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const baseSchedule: Schedule = {
  id: 3,
  profileId: 1,
  medicineId: 1,
  medicineName: 'Losartana',
  dosage: '1 comprimido',
  doseQuantity: 1,
  frequencyConfig: {
    type: 'specific_days',
    specificDays: [1, 2, 3, 4, 5],
    times: ['08:00', '20:00'],
  },
  startDate: '2026-07-01',
  isActive: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditScheduleScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '3' });
  mockUseSchedule.mockReturnValue({ data: baseSchedule, isLoading: false });
  mockUpdateSchedule.mockResolvedValue({ ...baseSchedule, dosage: '2 comprimidos' });
  mockFinalizeScheduleUpdate.mockResolvedValue(undefined);
  mockDeactivateSchedule.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('EditScheduleScreen', () => {
  it('mostra indicador de carregamento enquanto o agendamento não chega', () => {
    mockUseSchedule.mockReturnValue({ data: undefined, isLoading: true });
    renderScreen();
    expect(screen.queryByLabelText('Salvar alterações')).toBeNull();
  });

  it('carrega os dados do agendamento existente', () => {
    renderScreen();
    expect(screen.getByText('Losartana')).toBeTruthy();
    expect(screen.getByDisplayValue('1 comprimido')).toBeTruthy();
    expect(screen.getByLabelText('Remover horário 08:00')).toBeTruthy();
    expect(screen.getByLabelText('Remover horário 20:00')).toBeTruthy();
  });

  it('editar a dosagem e salvar chama updateSchedule com os novos dados', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByDisplayValue('1 comprimido'), '2 comprimidos');
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(mockUpdateSchedule).toHaveBeenCalledWith(3, {
        dosage: '2 comprimidos',
        doseQuantity: 1,
        frequencyConfig: {
          type: 'specific_days',
          specificDays: [1, 2, 3, 4, 5],
          times: ['08:00', '20:00'],
        },
        startDate: '2026-07-01',
        endDate: undefined,
      });
      expect(mockFinalizeScheduleUpdate).toHaveBeenCalledWith(
        { ...baseSchedule, dosage: '2 comprimidos' },
        'Losartana'
      );
    });
    expect(await screen.findByText('Horários atualizados!')).toBeTruthy();
  });

  it('remover um horário e salvar envia a lista de horários atualizada', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Remover horário 20:00'));
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(mockUpdateSchedule).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          frequencyConfig: expect.objectContaining({ times: ['08:00'] }),
        })
      );
    });
  });

  it('trocar a frequência para "A cada X horas" envia intervalHours ao salvar', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('A cada X horas'));
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(mockUpdateSchedule).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          frequencyConfig: { type: 'interval_hours', intervalHours: 8, times: ['08:00', '20:00'] },
        })
      );
    });
  });

  it('erro ao salvar exibe alerta', async () => {
    mockUpdateSchedule.mockRejectedValueOnce(new Error('Falha ao salvar agendamento'));
    renderScreen();
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao salvar agendamento');
    });
  });

  it('desativar agendamento confirma via alerta e chama deactivateSchedule', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Desativar agendamento'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Desativar agendamento',
      expect.any(String),
      expect.any(Array)
    );

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmButton = alertCall[2].find((b: { text: string }) => b.text === 'Desativar');
    confirmButton.onPress();

    await waitFor(() => {
      expect(mockDeactivateSchedule).toHaveBeenCalledWith(3);
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });
});
