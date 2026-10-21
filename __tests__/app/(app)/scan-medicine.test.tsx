import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import ScanMedicineScreen from '@/app/(app)/scan-medicine';
import { createMedicine } from '@/lib/database';
import { scanMedicine } from '@/lib/medicine-scanner';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  createMedicine: jest.fn(),
}));

jest.mock('@/lib/medicine-scanner', () => ({
  scanMedicine: jest.fn(),
}));

const mockRequestMediaLibraryPermissions =
  ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchImageLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockRequestCameraPermissions = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockCreateMedicine = createMedicine as jest.Mock;
const mockScanMedicine = scanMedicine as jest.Mock;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

const scanResult = {
  name: 'Paracetamol',
  concentration: '750mg',
  type: 'tablet' as const,
  stockQuantity: 20,
  stockUnit: 'comprimidos',
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ScanMedicineScreen />
    </QueryClientProvider>
  );
}

async function pickImageFromGallery() {
  mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
  mockLaunchImageLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://photo.jpg', base64: 'base64data' }],
  });
  fireEvent.press(screen.getByLabelText('Selecionar imagem da galeria'));
  await waitFor(() => expect(mockLaunchImageLibrary).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ScanMedicineScreen', () => {
  it('mostra o estado inicial sem imagem selecionada', () => {
    renderScreen();
    expect(screen.getByText('Nenhuma imagem selecionada')).toBeTruthy();
  });

  it('permissão de galeria negada mostra alerta e não abre o seletor', async () => {
    mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: false });
    renderScreen();
    fireEvent.press(screen.getByLabelText('Selecionar imagem da galeria'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permissão necessária',
        expect.stringContaining('galeria')
      );
    });
    expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
  });

  it('permissão de câmera negada mostra alerta e não abre a câmera', async () => {
    mockRequestCameraPermissions.mockResolvedValue({ granted: false });
    renderScreen();
    fireEvent.press(screen.getByLabelText('Tirar foto com câmera'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permissão necessária',
        expect.stringContaining('câmera')
      );
    });
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('selecionar imagem da galeria permite analisar e exibe o resultado identificado', async () => {
    mockScanMedicine.mockResolvedValue(scanResult);
    renderScreen();
    await pickImageFromGallery();

    fireEvent.press(screen.getByLabelText('Analisar embalagem com inteligência artificial'));

    await waitFor(() => {
      expect(mockScanMedicine).toHaveBeenCalledWith('base64data');
    });
    expect(await screen.findByDisplayValue('Paracetamol')).toBeTruthy();
    expect(screen.getByDisplayValue('750mg')).toBeTruthy();
  });

  it('erro ao analisar mostra alerta e não trava a tela', async () => {
    mockScanMedicine.mockRejectedValue(new Error('Falha na análise'));
    renderScreen();
    await pickImageFromGallery();

    fireEvent.press(screen.getByLabelText('Analisar embalagem com inteligência artificial'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro ao analisar', 'Falha na análise');
    });
    expect(screen.getByLabelText('Analisar embalagem com inteligência artificial')).toBeTruthy();
  });

  it('salvar o medicamento identificado chama createMedicine e mostra o toast de sucesso', async () => {
    mockScanMedicine.mockResolvedValue(scanResult);
    mockCreateMedicine.mockResolvedValue({ id: 42 });
    renderScreen();
    await pickImageFromGallery();
    fireEvent.press(screen.getByLabelText('Analisar embalagem com inteligência artificial'));
    await screen.findByDisplayValue('Paracetamol');

    fireEvent.press(screen.getByLabelText('Salvar medicamento'));

    await waitFor(() => {
      expect(mockCreateMedicine).toHaveBeenCalledWith({
        name: 'Paracetamol 750mg',
        type: 'tablet',
        stockQuantity: 20,
        stockUnit: 'comprimidos',
        lowStockThreshold: 2,
      });
    });
    expect(await screen.findByText('Medicamento salvo!')).toBeTruthy();
  });

  it('nome vazio impede salvar e mostra alerta', async () => {
    mockScanMedicine.mockResolvedValue(scanResult);
    renderScreen();
    await pickImageFromGallery();
    fireEvent.press(screen.getByLabelText('Analisar embalagem com inteligência artificial'));
    await screen.findByDisplayValue('Paracetamol');

    fireEvent.changeText(screen.getByDisplayValue('Paracetamol'), '');
    fireEvent.press(screen.getByLabelText('Salvar medicamento'));

    expect(Alert.alert).toHaveBeenCalledWith('Atenção', 'O nome do medicamento é obrigatório.');
    expect(mockCreateMedicine).not.toHaveBeenCalled();
  });
});
