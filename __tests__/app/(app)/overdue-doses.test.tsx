import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import OverdueScreen from '@/app/(app)/overdue-doses';
import { useDosesForDate } from '@/hooks/use-doses';
import type { Dose } from '@/types';

jest.mock('@/hooks/use-doses', () => ({
  useDosesForDate: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

const mockUseDosesForDate = useDosesForDate as jest.Mock;
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };
const mockQueryClient = { invalidateQueries: jest.fn() };

const overdueDose: Dose = {
  id: 42,
  profileId: 1,
  scheduleId: 1,
  medicineId: 5,
  medicineName: 'Metformina',
  dosage: '850mg',
  scheduledTime: '2026-07-14T09:00:00',
  status: 'pending',
};

const upcomingDose: Dose = {
  id: 43,
  profileId: 1,
  scheduleId: 2,
  medicineId: 6,
  medicineName: 'Vitamina D',
  dosage: '1 cápsula',
  scheduledTime: '2026-07-14T11:00:00',
  status: 'pending',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00'));
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useQueryClient as jest.Mock).mockReturnValue(mockQueryClient);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('OverdueScreen', () => {
  it('mostra estado de carregamento', () => {
    mockUseDosesForDate.mockReturnValue({ data: undefined, isLoading: true });

    render(<OverdueScreen />);

    expect(screen.getByText('Carregando...')).toBeTruthy();
  });

  it('mostra estado vazio quando não há doses atrasadas', async () => {
    mockUseDosesForDate.mockReturnValue({ data: [upcomingDose], isLoading: false });

    render(<OverdueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma dose atrasada')).toBeTruthy();
    });
  });

  it('pressionar "Fechar" no estado vazio invalida queries e volta', async () => {
    mockUseDosesForDate.mockReturnValue({ data: [], isLoading: false });

    render(<OverdueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Fechar')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Fechar'));

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('lista as doses atrasadas com nome, dosagem e minutos de atraso', async () => {
    mockUseDosesForDate.mockReturnValue({ data: [overdueDose, upcomingDose], isLoading: false });

    render(<OverdueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Metformina')).toBeTruthy();
    });
    expect(screen.getByText('850mg')).toBeTruthy();
    expect(screen.getByText('60min')).toBeTruthy();
    expect(screen.queryByText('Vitamina D')).toBeNull();
  });

  it('pressionar "Registrar agora" navega para /reminder-alert com o doseId', async () => {
    mockUseDosesForDate.mockReturnValue({ data: [overdueDose], isLoading: false });

    render(<OverdueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Registrar agora')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Registrar agora'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/reminder-alert',
      params: { doseId: '42' },
    });
  });

  it('pressionar o botão de voltar no cabeçalho invalida queries e fecha a tela', async () => {
    mockUseDosesForDate.mockReturnValue({ data: [overdueDose], isLoading: false });

    render(<OverdueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Doses Atrasadas')).toBeTruthy();
    });
    const [backButton] = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(backButton);

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
