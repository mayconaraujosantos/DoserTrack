import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import DashboardScreen from '@/app/(app)/(tabs)/index';
import { useDosesForDate, useDosesForDateRange } from '@/hooks/use-doses';
import { useMedicines } from '@/hooks/use-medicines';
import { updateDoseStatus } from '@/lib/database';
import { haptic } from '@/lib/haptics';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import { useAppStore } from '@/lib/store';
import { localDateStr } from '@/lib/date';
import type { Dose, Profile } from '@/types';

jest.mock('@/hooks/use-doses', () => ({
  useDosesForDate: jest.fn(),
  useDosesForDateRange: jest.fn(),
}));

jest.mock('@/hooks/use-medicines', () => ({
  useMedicines: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  updateDoseStatus: jest.fn(),
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

jest.mock('@/lib/query-keys', () => ({
  invalidateTrackingQueries: jest.fn(),
}));

const mockUseDosesForDate = useDosesForDate as jest.Mock;
const mockUseDosesForDateRange = useDosesForDateRange as jest.Mock;
const mockUseMedicines = useMedicines as jest.Mock;
const mockUpdateDoseStatus = updateDoseStatus as jest.Mock;
const mockInvalidateTrackingQueries = invalidateTrackingQueries as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const profile: Profile = {
  id: 1,
  name: 'Maria',
  color: '#5D54FF',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const pendingDose: Dose = {
  id: 1,
  profileId: 1,
  scheduleId: 1,
  medicineId: 1,
  medicineName: 'Dipirona',
  dosage: '1 comprimido',
  scheduledTime: '2026-07-14T08:00:00',
  status: 'pending',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DashboardScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T06:00:00'));
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  useAppStore.setState({
    selectedDate: '2026-07-14',
    activeProfile: profile,
    dbReady: true,
  });
  mockUseDosesForDateRange.mockReturnValue({ data: [] });
  mockUseMedicines.mockReturnValue({ data: [] });
  mockUpdateDoseStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  useAppStore.setState({ selectedDate: localDateStr(), activeProfile: null, dbReady: false });
});

describe('DashboardScreen', () => {
  it('renderiza a lista de doses do dia selecionado', () => {
    mockUseDosesForDate.mockReturnValue({
      data: [pendingDose],
      isLoading: false,
      refetch: jest.fn(),
    });

    renderScreen();

    expect(screen.getByText('Dipirona')).toBeTruthy();
    expect(screen.getByText('1 comprimido')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
  });

  it('marcar uma dose como tomada chama updateDoseStatus com o id e o horário atual', async () => {
    mockUseDosesForDate.mockReturnValue({
      data: [pendingDose],
      isLoading: false,
      refetch: jest.fn(),
    });

    renderScreen();

    fireEvent(screen.getByLabelText('Marcar como tomado'), 'valueChange', true);

    await waitFor(() => {
      expect(mockUpdateDoseStatus).toHaveBeenCalledWith(1, 'taken', expect.any(String));
      expect(haptic.success).toHaveBeenCalled();
      expect(mockInvalidateTrackingQueries).toHaveBeenCalled();
    });
  });

  it('mostra o estado vazio quando não há doses nem medicamentos cadastrados para o dia', () => {
    mockUseDosesForDate.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseMedicines.mockReturnValue({ data: [] });

    renderScreen();

    expect(screen.getByText('Nenhum dado registrado ainda')).toBeTruthy();
  });

  it('selecionar outro dia na tira de datas atualiza selectedDate no store', () => {
    mockUseDosesForDate.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });

    renderScreen();

    fireEvent.press(screen.getByLabelText('Dia 16'));

    expect(useAppStore.getState().selectedDate).toBe('2026-07-16');
  });
});
