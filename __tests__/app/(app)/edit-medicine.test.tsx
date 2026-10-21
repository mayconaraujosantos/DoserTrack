import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EditMedicineScreen from '@/app/(app)/edit-medicine';
import { useMedicine } from '@/hooks/use-medicines';
import { useSchedulesByMedicine } from '@/hooks/use-schedules';
import { updateMedicine } from '@/lib/database';
import type { Medicine, Schedule } from '@/types';

jest.mock('@/hooks/use-medicines', () => ({
  useMedicine: jest.fn(),
}));

jest.mock('@/hooks/use-schedules', () => ({
  useSchedulesByMedicine: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  updateMedicine: jest.fn(),
}));

const mockUseMedicine = useMedicine as jest.Mock;
const mockUseSchedulesByMedicine = useSchedulesByMedicine as jest.Mock;

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

const medicine: Medicine = {
  id: 5,
  profileId: 1,
  name: 'Amoxicilina',
  type: 'capsule',
  stockQuantity: 20,
  stockUnit: 'cápsulas',
  lowStockThreshold: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const schedule: Schedule = {
  id: 9,
  profileId: 1,
  medicineId: 5,
  dosage: '1 cápsula',
  doseQuantity: 1,
  frequencyConfig: { type: 'interval_hours', intervalHours: 8, times: ['08:00'] },
  startDate: '2026-01-01',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: '5' });
  mockUseMedicine.mockReturnValue({ data: medicine, isLoading: false });
  mockUseSchedulesByMedicine.mockReturnValue({ data: [schedule] });
  (updateMedicine as jest.Mock).mockResolvedValue({ ...medicine });
});

describe('EditMedicineScreen', () => {
  it('mostra indicador de carregamento enquanto o medicamento não chegou', () => {
    mockUseMedicine.mockReturnValue({ data: undefined, isLoading: true });

    renderWithClient(<EditMedicineScreen />);

    expect(screen.queryByText('Nome do medicamento *')).toBeNull();
  });

  it('carrega os dados do medicamento nos campos', () => {
    renderWithClient(<EditMedicineScreen />);

    expect(screen.getByDisplayValue('Amoxicilina')).toBeTruthy();
    expect(screen.getByDisplayValue('20')).toBeTruthy();
    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('lista os horários cadastrados do medicamento', () => {
    renderWithClient(<EditMedicineScreen />);

    expect(screen.getByText('1 cápsula')).toBeTruthy();
    expect(screen.getByText('A cada 8h • 08:00')).toBeTruthy();
  });

  it('mostra mensagem quando não há horários cadastrados', () => {
    mockUseSchedulesByMedicine.mockReturnValue({ data: [] });

    renderWithClient(<EditMedicineScreen />);

    expect(screen.getByText('Nenhum horário cadastrado para este medicamento.')).toBeTruthy();
  });

  it('editar o nome e salvar chama updateMedicine com os dados atualizados e volta', async () => {
    renderWithClient(<EditMedicineScreen />);

    fireEvent.changeText(screen.getByDisplayValue('Amoxicilina'), 'Amoxicilina 500mg');
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(updateMedicine).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          name: 'Amoxicilina 500mg',
          type: 'capsule',
          stockQuantity: 20,
          stockUnit: 'cápsulas',
          lowStockThreshold: 5,
        })
      );
    });
    await waitFor(() => {
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });

  it('não salva quando o nome fica vazio', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderWithClient(<EditMedicineScreen />);

    fireEvent.changeText(screen.getByDisplayValue('Amoxicilina'), '');
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Nome obrigatório', 'Digite o nome do medicamento.');
    });
    expect(updateMedicine).not.toHaveBeenCalled();
  });

  it('não salva quando a quantidade em estoque é inválida', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderWithClient(<EditMedicineScreen />);

    fireEvent.changeText(screen.getByDisplayValue('20'), '-5');
    fireEvent.press(screen.getByLabelText('Salvar alterações'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Quantidade inválida',
        'Digite uma quantidade válida.'
      );
    });
    expect(updateMedicine).not.toHaveBeenCalled();
  });

  it('selecionar outro tipo de medicamento muda a unidade exibida', () => {
    renderWithClient(<EditMedicineScreen />);

    fireEvent.press(screen.getByLabelText('Gota'));

    expect(screen.getAllByText('frascos').length).toBeGreaterThan(0);
  });

  it('pressionar um horário existente navega para editá-lo', () => {
    renderWithClient(<EditMedicineScreen />);

    fireEvent.press(screen.getByLabelText('Editar horário de 1 cápsula'));

    expect(mockRouter.push).toHaveBeenCalledWith('/edit-schedule?id=9');
  });

  it('pressionar "+ Adicionar horário" navega para criar um novo horário', () => {
    renderWithClient(<EditMedicineScreen />);

    fireEvent.press(screen.getByLabelText('Adicionar novo horário'));

    expect(mockRouter.push).toHaveBeenCalledWith('/add-schedule?medicineId=5');
  });
});
