import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MedicinesScreen from '@/app/(app)/(tabs)/medicines';
import { useMedicines } from '@/hooks/use-medicines';
import { useStockProjections } from '@/hooks/use-stock-projections';
import { deleteMedicine } from '@/lib/database';
import { haptic } from '@/lib/haptics';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import type { Medicine } from '@/types';

jest.mock('@/hooks/use-medicines', () => ({
  useMedicines: jest.fn(),
}));

jest.mock('@/hooks/use-stock-projections', () => ({
  useStockProjections: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  deleteMedicine: jest.fn(),
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

const mockUseMedicines = useMedicines as jest.Mock;
const mockUseStockProjections = useStockProjections as jest.Mock;
const mockDeleteMedicine = deleteMedicine as jest.Mock;
const mockInvalidateTrackingQueries = invalidateTrackingQueries as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const lowStockMed: Medicine = {
  id: 1,
  profileId: 1,
  name: 'Amoxicilina',
  type: 'capsule',
  stockQuantity: 2,
  stockUnit: 'cápsulas',
  lowStockThreshold: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const okMed: Medicine = {
  id: 2,
  profileId: 1,
  name: 'Vitamina D',
  type: 'tablet',
  stockQuantity: 30,
  stockUnit: 'comprimidos',
  lowStockThreshold: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MedicinesScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  mockUseMedicines.mockReturnValue({ data: [lowStockMed, okMed], isLoading: false });
  mockUseStockProjections.mockReturnValue({ data: {} });
  mockDeleteMedicine.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MedicinesScreen', () => {
  it('renderiza a lista populada com os medicamentos cadastrados', () => {
    renderScreen();

    expect(screen.getByText('Amoxicilina')).toBeTruthy();
    expect(screen.getByText('Vitamina D')).toBeTruthy();
    expect(screen.getByText('2 cadastrados')).toBeTruthy();
  });

  it('mostra o estado vazio quando não há medicamentos cadastrados', () => {
    mockUseMedicines.mockReturnValue({ data: [], isLoading: false });
    renderScreen();

    expect(screen.getByText('Nenhum medicamento')).toBeTruthy();
    fireEvent.press(screen.getByText('Adicionar medicamento'));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-medicine');
  });

  it('exibe o indicador de estoque baixo para o medicamento abaixo do limite', () => {
    renderScreen();

    expect(screen.getByText('2 cápsulas')).toBeTruthy();
    expect(screen.getByText('30 comprimidos')).toBeTruthy();
  });

  it('tocar em um item navega para a tela de edição', () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Vitamina D'));
    expect(mockRouter.push).toHaveBeenCalledWith('/edit-medicine?id=2');
  });

  it('pressionar "adicionar medicamento" no cabeçalho navega para add-medicine', () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Adicionar medicamento'));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-medicine');
  });

  it('pressionar e segurar entra em modo de seleção e permite excluir o selecionado', async () => {
    renderScreen();

    fireEvent(screen.getByLabelText('Vitamina D'), 'longPress');
    expect(screen.getByText('1 selecionado')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Excluir selecionados'));

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    alertCall[2][1].onPress();

    await waitFor(() => {
      expect(mockDeleteMedicine).toHaveBeenCalledWith(2, expect.anything());
      expect(haptic.warning).toHaveBeenCalled();
      expect(mockInvalidateTrackingQueries).toHaveBeenCalled();
    });
  });
});
