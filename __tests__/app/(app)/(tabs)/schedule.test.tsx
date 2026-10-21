import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import ScheduleScreen from '@/app/(app)/(tabs)/schedule';
import { useDatesWithDosesInMonth, useDosesForDate } from '@/hooks/use-doses';
import { useAppStore } from '@/lib/store';
import type { Dose } from '@/types';

jest.mock('@/hooks/use-doses', () => ({
  useDatesWithDosesInMonth: jest.fn(),
  useDosesForDate: jest.fn(),
}));

const mockUseDosesForDate = useDosesForDate as jest.Mock;
const mockUseDatesWithDosesInMonth = useDatesWithDosesInMonth as jest.Mock;

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

const dose: Dose = {
  id: 1,
  profileId: 1,
  scheduleId: 1,
  medicineId: 1,
  medicineName: 'Metformina',
  dosage: '850mg',
  scheduledTime: '2026-07-14T08:00:00',
  status: 'pending',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00'));
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  useAppStore.setState({ selectedDate: '2026-07-14' });
  mockUseDosesForDate.mockReturnValue({ data: [dose], isLoading: false });
  mockUseDatesWithDosesInMonth.mockReturnValue({ data: new Set(['2026-07-14']) });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ScheduleScreen', () => {
  it('renderiza o título "Agenda" e o mês/ano atuais', () => {
    render(<ScheduleScreen />);

    expect(screen.getByText('Agenda')).toBeTruthy();
    expect(screen.getByText('Julho 2026')).toBeTruthy();
  });

  it('lista as doses do dia selecionado', () => {
    render(<ScheduleScreen />);

    expect(screen.getByText('Metformina')).toBeTruthy();
    expect(screen.getByText('850mg')).toBeTruthy();
    expect(screen.getByText('1 dose')).toBeTruthy();
  });

  it('mostra estado vazio quando não há doses no dia', () => {
    mockUseDosesForDate.mockReturnValue({ data: [], isLoading: false });

    render(<ScheduleScreen />);

    expect(screen.getByText('Sem doses nesse dia')).toBeTruthy();
    expect(screen.getByText('0 doses')).toBeTruthy();
  });

  it('mostra o indicador de carregamento enquanto as doses não chegam', () => {
    mockUseDosesForDate.mockReturnValue({ data: undefined, isLoading: true });

    render(<ScheduleScreen />);

    expect(screen.queryByText('Metformina')).toBeNull();
    expect(screen.queryByText('Sem doses nesse dia')).toBeNull();
  });

  it('tocar em um dia do calendário seleciona aquela data', () => {
    render(<ScheduleScreen />);

    fireEvent.press(screen.getByLabelText('10 de Julho'));

    expect(useAppStore.getState().selectedDate).toBe('2026-07-10');
  });

  it('navegar para o mês seguinte e voltar atualiza o cabeçalho do calendário', () => {
    render(<ScheduleScreen />);

    fireEvent.press(screen.getByLabelText('Próximo mês'));
    expect(screen.getByText('Agosto 2026')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Mês anterior'));
    expect(screen.getByText('Julho 2026')).toBeTruthy();
  });

  it('pressionar "Adicionar medicamento" navega para a tela de criação', () => {
    render(<ScheduleScreen />);

    fireEvent.press(screen.getByLabelText('Adicionar medicamento'));

    expect(mockRouter.push).toHaveBeenCalledWith('/add-medicine');
  });
});
