import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AddMedicineScreen from '@/app/(app)/add-medicine';
import { createMedicine, createSchedule } from '@/lib/database';
import { finalizeNewSchedule } from '@/lib/dose-scheduling';
import { notifyLowStock } from '@/lib/notifications';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import type { Medicine, Schedule } from '@/types';

jest.mock('@/lib/database', () => ({
  createMedicine: jest.fn(),
  createSchedule: jest.fn(),
}));

jest.mock('@/lib/dose-scheduling', () => ({
  finalizeNewSchedule: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  notifyLowStock: jest.fn(),
}));

jest.mock('@/lib/query-keys', () => ({
  invalidateTrackingQueries: jest.fn(),
}));

const mockCreateMedicine = createMedicine as jest.Mock;
const mockCreateSchedule = createSchedule as jest.Mock;
const mockFinalizeNewSchedule = finalizeNewSchedule as jest.Mock;
const mockNotifyLowStock = notifyLowStock as jest.Mock;
const mockInvalidateTrackingQueries = invalidateTrackingQueries as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const createdMedicine: Medicine = {
  id: 5,
  profileId: 1,
  name: 'Ibuprofeno',
  type: 'capsule',
  stockQuantity: 0,
  stockUnit: 'cápsulas',
  lowStockThreshold: 5,
  createdAt: '2026-07-14T00:00:00.000Z',
};

const createdSchedule: Schedule = {
  id: 20,
  profileId: 1,
  medicineId: 5,
  dosage: '1 cápsulas',
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
      <AddMedicineScreen />
    </QueryClientProvider>
  );
}

function goToLastStep() {
  fireEvent.changeText(screen.getByPlaceholderText('Ex: Paracetamol 750mg'), createdMedicine.name);
  fireEvent.press(screen.getByLabelText('Continuar para próximo passo'));
  fireEvent.press(screen.getByLabelText('Continuar para próximo passo'));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00'));
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  mockCreateMedicine.mockResolvedValue(createdMedicine);
  mockCreateSchedule.mockResolvedValue(createdSchedule);
  mockFinalizeNewSchedule.mockResolvedValue(undefined);
  mockNotifyLowStock.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AddMedicineScreen', () => {
  it('impede avançar do passo 1 sem preencher o nome', () => {
    renderScreen();

    const continueButton = screen.getByLabelText('Continuar para próximo passo');
    expect(continueButton.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(continueButton);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Ex: Paracetamol 750mg')).toBeTruthy();
  });

  it('preencher o formulário mínimo e salvar com horário cria o medicamento, o agendamento e navega de volta', async () => {
    renderScreen();
    goToLastStep();

    fireEvent.press(screen.getByLabelText('Salvar medicamento com horário'));

    await waitFor(() => {
      expect(mockCreateMedicine).toHaveBeenCalledWith({
        name: 'Ibuprofeno',
        type: 'capsule',
        stockQuantity: 0,
        stockUnit: 'cápsulas',
        photoUri: undefined,
        lowStockThreshold: 5,
      });
      expect(mockCreateSchedule).toHaveBeenCalledWith({
        medicineId: 5,
        dosage: '1 cápsulas',
        doseQuantity: 1,
        frequencyConfig: {
          type: 'specific_days',
          specificDays: [1, 2, 3, 4, 5],
          times: ['08:00'],
        },
        startDate: '2026-07-14',
        endDate: undefined,
        isActive: true,
      });
      expect(mockFinalizeNewSchedule).toHaveBeenCalledWith(createdSchedule, 'Ibuprofeno');
      expect(mockInvalidateTrackingQueries).toHaveBeenCalled();
    });

    expect(await screen.findByText('Medicamento e horários salvos!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2200);
    });
    await waitFor(() => {
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('salvar sem horário cria apenas o medicamento, sem criar agendamento', async () => {
    renderScreen();
    goToLastStep();

    fireEvent.press(screen.getByLabelText('Salvar sem horário'));

    await waitFor(() => {
      expect(mockCreateMedicine).toHaveBeenCalled();
    });
    expect(mockCreateSchedule).not.toHaveBeenCalled();
    expect(await screen.findByText('Medicamento salvo!')).toBeTruthy();
  });

  it('salvar com horário sem nenhum dia da semana selecionado mostra alerta e não cria o agendamento', async () => {
    renderScreen();
    goToLastStep();

    for (const day of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']) {
      fireEvent.press(screen.getByText(day));
    }

    fireEvent.press(screen.getByLabelText('Salvar medicamento com horário'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Selecione pelo menos um dia da semana.');
    });
    expect(mockCreateSchedule).not.toHaveBeenCalled();
  });
});
