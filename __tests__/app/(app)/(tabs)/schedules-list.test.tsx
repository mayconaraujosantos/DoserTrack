import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SchedulesListScreen from '@/app/(app)/(tabs)/schedules-list';
import { useSchedules } from '@/hooks/use-schedules';
import { describeFrequency } from '@/lib/frequency-strategy';
import type { Schedule } from '@/types';

jest.mock('@/hooks/use-schedules', () => ({
  useSchedules: jest.fn(),
}));

const mockUseSchedules = useSchedules as jest.Mock;
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const schedule: Schedule = {
  id: 7,
  profileId: 1,
  medicineId: 3,
  medicineName: 'Losartana',
  dosage: '50mg',
  doseQuantity: 1,
  frequencyConfig: { type: 'specific_days', specificDays: [1, 3, 5], times: ['08:00', '20:00'] },
  startDate: '2026-01-01',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('SchedulesListScreen', () => {
  it('mostra indicador de carregamento enquanto isLoading', () => {
    mockUseSchedules.mockReturnValue({ data: undefined, isLoading: true });

    render(<SchedulesListScreen />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('mostra mensagem de vazio quando não há agendamentos', () => {
    mockUseSchedules.mockReturnValue({ data: [], isLoading: false });

    render(<SchedulesListScreen />);

    expect(screen.getByText('Nenhum agendamento ativo')).toBeTruthy();
  });

  it('renderiza a lista de agendamentos com nome e frequência', () => {
    mockUseSchedules.mockReturnValue({ data: [schedule], isLoading: false });

    render(<SchedulesListScreen />);

    expect(screen.getByText('Losartana')).toBeTruthy();
    expect(screen.getByText(`50mg • ${describeFrequency(schedule.frequencyConfig)}`)).toBeTruthy();
  });

  it('pressionar uma linha navega para /edit-schedule com o id', () => {
    mockUseSchedules.mockReturnValue({ data: [schedule], isLoading: false });

    render(<SchedulesListScreen />);
    fireEvent.press(screen.getByLabelText('Editar agendamento de Losartana'));

    expect(mockRouter.push).toHaveBeenCalledWith('/edit-schedule?id=7');
  });

  it('pressionar "Adicionar agendamento" navega para /add-schedule', () => {
    mockUseSchedules.mockReturnValue({ data: [], isLoading: false });

    render(<SchedulesListScreen />);
    fireEvent.press(screen.getByLabelText('Adicionar agendamento'));

    expect(mockRouter.push).toHaveBeenCalledWith('/add-schedule');
  });
});
