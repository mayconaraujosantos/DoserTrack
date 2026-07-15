import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScanPrescriptionScreen from '@/app/(app)/scan-prescription';
import { createMedicine, createSchedule } from '@/lib/database';
import { finalizeNewSchedule } from '@/lib/dose-scheduling';
import { scanPrescription, type PrescriptionData } from '@/lib/prescription-scanner';
import { getCachedPrescription } from '@/lib/scan-cache';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import type { Medicine, Schedule } from '@/types';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  createMedicine: jest.fn(),
  createSchedule: jest.fn(),
}));

jest.mock('@/lib/dose-scheduling', () => ({
  finalizeNewSchedule: jest.fn(),
}));

jest.mock('@/lib/prescription-scanner', () => ({
  scanPrescription: jest.fn(),
}));

jest.mock('@/lib/scan-cache', () => ({
  getCachedPrescription: jest.fn(),
  cachePrescription: jest.fn(),
  clearPrescriptionCache: jest.fn(),
}));

jest.mock('@/lib/query-keys', () => ({
  invalidateTrackingQueries: jest.fn(),
}));

const mockRequestMediaLibraryPermissions =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockCreateMedicine = createMedicine as jest.Mock;
const mockCreateSchedule = createSchedule as jest.Mock;
const mockFinalizeNewSchedule = finalizeNewSchedule as jest.Mock;
const mockScanPrescription = scanPrescription as jest.Mock;
const mockGetCachedPrescription = getCachedPrescription as jest.Mock;
const mockInvalidateTrackingQueries = invalidateTrackingQueries as jest.Mock;

const item: PrescriptionData = {
  name: 'Paracetamol',
  concentration: '750mg',
  type: 'tablet',
  quantity: 20,
  instructions: 'Tomar após refeições',
  timesPerDay: 2,
  timeHints: ['manhã', 'noite'],
  isContinuous: true,
};

const createdMedicine: Medicine = {
  id: 7,
  profileId: 1,
  name: 'Paracetamol 750mg',
  type: 'tablet',
  stockQuantity: 20,
  stockUnit: 'comprimidos',
  lowStockThreshold: 2,
  createdAt: '2026-07-14T00:00:00.000Z',
};

const createdSchedule: Schedule = {
  id: 30,
  profileId: 1,
  medicineId: 7,
  dosage: 'Tomar após refeições',
  doseQuantity: 1,
  frequencyConfig: {
    type: 'specific_days',
    specificDays: [0, 1, 2, 3, 4, 5, 6],
    times: ['08:00', '20:00'],
  },
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
      <ScanPrescriptionScreen />
    </QueryClientProvider>
  );
}

async function pickImageFromGallery() {
  mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
  mockLaunchImageLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://rx.jpg', base64: 'abc123' }],
  });
  fireEvent.press(screen.getByLabelText('Selecionar imagem da galeria'));
  await waitFor(() => expect(mockLaunchImageLibrary).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00'));
  mockGetCachedPrescription.mockResolvedValue(null);
  mockCreateMedicine.mockResolvedValue(createdMedicine);
  mockCreateSchedule.mockResolvedValue(createdSchedule);
  mockFinalizeNewSchedule.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ScanPrescriptionScreen', () => {
  it('escolher uma imagem da galeria e analisar dispara o scan da receita', async () => {
    mockScanPrescription.mockResolvedValue([item]);
    renderScreen();

    await pickImageFromGallery();
    fireEvent.press(screen.getByLabelText('Analisar receita com inteligência artificial'));

    await waitFor(() => {
      expect(mockScanPrescription).toHaveBeenCalledWith('abc123');
    });
  });

  it('ao retornar itens da receita, lista os medicamentos extraídos para revisão', async () => {
    mockScanPrescription.mockResolvedValue([item]);
    renderScreen();

    await pickImageFromGallery();
    fireEvent.press(screen.getByLabelText('Analisar receita com inteligência artificial'));

    expect(await screen.findByText('Paracetamol')).toBeTruthy();
    expect(screen.getByText('1 medicamento encontrado')).toBeTruthy();
  });

  it('confirmar um item extraído cria o medicamento e o agendamento correspondente', async () => {
    mockScanPrescription.mockResolvedValue([item]);
    renderScreen();

    await pickImageFromGallery();
    fireEvent.press(screen.getByLabelText('Analisar receita com inteligência artificial'));
    await screen.findByText('Paracetamol');

    fireEvent.press(screen.getByLabelText('Adicionar Paracetamol'));
    fireEvent.press(screen.getByLabelText('Salvar medicamento e criar alarmes'));

    await waitFor(() => {
      expect(mockCreateMedicine).toHaveBeenCalledWith({
        name: 'Paracetamol 750mg',
        type: 'tablet',
        stockQuantity: 20,
        stockUnit: 'comprimidos',
        lowStockThreshold: 2,
      });
      expect(mockCreateSchedule).toHaveBeenCalledWith({
        medicineId: 7,
        dosage: 'Tomar após refeições',
        doseQuantity: 1,
        frequencyConfig: {
          type: 'specific_days',
          specificDays: [0, 1, 2, 3, 4, 5, 6],
          times: ['08:00', '20:00'],
        },
        startDate: '2026-07-14',
        endDate: undefined,
        isActive: true,
      });
      expect(mockFinalizeNewSchedule).toHaveBeenCalledWith(createdSchedule, 'Paracetamol 750mg');
      expect(mockInvalidateTrackingQueries).toHaveBeenCalled();
    });

    expect(await screen.findByText('Receita concluída com sucesso!')).toBeTruthy();
  });

  it('erro ao analisar a receita mostra alerta e não trava a tela', async () => {
    mockScanPrescription.mockRejectedValue(new Error('Não foi possível interpretar a receita.'));
    renderScreen();

    await pickImageFromGallery();
    fireEvent.press(screen.getByLabelText('Analisar receita com inteligência artificial'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Erro ao analisar',
        'Não foi possível interpretar a receita.'
      );
    });
    expect(screen.getByLabelText('Analisar receita com inteligência artificial')).toBeTruthy();
  });
});
