import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AddScheduleScreen from '@/app/(app)/add-schedule';
import { useMedicines } from '@/hooks/use-medicines';
import { createSchedule } from '@/lib/database';
import { finalizeNewSchedule } from '@/lib/dose-scheduling';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import type { Medicine, Schedule } from '@/types';

jest.mock('@/hooks/use-medicines', () => ({
  useMedicines: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  createSchedule: jest.fn(),
}));

jest.mock('@/lib/dose-scheduling', () => ({
  finalizeNewSchedule: jest.fn(),
}));

jest.mock('@/lib/query-keys', () => ({
  invalidateTrackingQueries: jest.fn(),
}));

const mockUseMedicines = useMedicines as jest.Mock;
const mockCreateSchedule = createSchedule as jest.Mock;
const mockFinalizeNewSchedule = finalizeNewSchedule as jest.Mock;
const mockInvalidateTrackingQueries = invalidateTrackingQueries as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const medicine: Medicine = {
  id: 1,
  profileId: 1,
  name: 'Dipirona',
  type: 'tablet',
  stockQuantity: 20,
  stockUnit: 'comprimidos',
  lowStockThreshold: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const createdSchedule: Schedule = {
  id: 10,
  profileId: 1,
  medicineId: 1,
  dosage: '1 comprimido',
  doseQuantity: 1,
  frequencyConfig: { type: 'specific_days', specificDays: [1, 2, 3, 4, 5], times: ['08:00'] },
  startDate: '2026-07-14',
  isActive: true,
  createdAt: '2026-07-14T00:00:00.000Z',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddScheduleScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00'));
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  mockUseMedicines.mockReturnValue({ data: [medicine] });
  mockCreateSchedule.mockResolvedValue(createdSchedule);
  mockFinalizeNewSchedule.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AddScheduleScreen', () => {
  it('mostra estado vazio e permite navegar para cadastro manual ou scanner quando não há medicamentos', () => {
    mockUseMedicines.mockReturnValue({ data: [] });
    renderScreen();

    expect(screen.getByText('Nenhum medicamento cadastrado')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Cadastrar medicamento manualmente'));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-medicine');

    fireEvent.press(screen.getByLabelText('Escanear embalagem do medicamento'));
    expect(mockRouter.push).toHaveBeenCalledWith('/scan-medicine');
  });

  it('preencher o formulário mínimo e submeter cria o agendamento, gera as doses e navega de volta', async () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Dipirona'));
    fireEvent.changeText(screen.getByPlaceholderText('Ex: 1 cápsula'), '1 comprimido');
    fireEvent.press(screen.getByLabelText('Salvar horário'));

    await waitFor(() => {
      expect(mockCreateSchedule).toHaveBeenCalledWith({
        medicineId: 1,
        dosage: '1 comprimido',
        doseQuantity: 1,
        frequencyConfig: { type: 'specific_days', specificDays: [1, 2, 3, 4, 5], times: ['08:00'] },
        startDate: '2026-07-14',
        endDate: undefined,
        isActive: true,
      });
      expect(mockFinalizeNewSchedule).toHaveBeenCalledWith(createdSchedule, 'Dipirona');
      expect(mockInvalidateTrackingQueries).toHaveBeenCalled();
    });

    expect(await screen.findByText('Horários salvos com sucesso!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2200);
    });
    await waitFor(() => {
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('submeter sem selecionar medicamento não chama createSchedule e mostra alerta de validação', async () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('Ex: 1 cápsula'), '1 comprimido');
    fireEvent.press(screen.getByLabelText('Salvar horário'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Selecione um medicamento');
    });
    expect(mockCreateSchedule).not.toHaveBeenCalled();
  });

  it('trocar o tipo de frequência de "dias da semana" para "a cada X horas" atualiza os campos exibidos', () => {
    renderScreen();

    expect(screen.getByLabelText('Dom')).toBeTruthy();

    fireEvent.press(screen.getByText('A cada X horas'));

    expect(screen.queryByLabelText('Dom')).toBeNull();
    expect(screen.getByText('A cada')).toBeTruthy();
    expect(screen.getByText('horas')).toBeTruthy();
  });
});
