import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import HistoryScreen from '@/app/(app)/(tabs)/history';
import { useWeekAdherence } from '@/hooks/use-adherence';
import { getRecentHistory } from '@/lib/database';
import { generateAdherenceReport } from '@/lib/report';
import { useAppStore } from '@/lib/store';
import type { Dose } from '@/types';
import { localDateStr } from '@/lib/date';

jest.mock('@/hooks/use-adherence', () => ({
  useWeekAdherence: jest.fn(),
}));

jest.mock('@/lib/database', () => ({
  getRecentHistory: jest.fn(),
}));

jest.mock('@/lib/report', () => ({
  generateAdherenceReport: jest.fn(),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const mockUseWeekAdherence = useWeekAdherence as jest.Mock;
const mockGetRecentHistory = getRecentHistory as jest.Mock;
const mockGenerateAdherenceReport = generateAdherenceReport as jest.Mock;
const mockPrintToFileAsync = Print.printToFileAsync as jest.Mock;
const mockIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HistoryScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-07-14T10:00:00'));
  useAppStore.setState({ dbReady: true });
  mockUseWeekAdherence.mockReturnValue({ data: [], isLoading: false });
  mockGetRecentHistory.mockResolvedValue([]);
  mockGenerateAdherenceReport.mockResolvedValue('<html></html>');
  mockPrintToFileAsync.mockResolvedValue({ uri: 'file://report.pdf' });
  mockIsAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('HistoryScreen', () => {
  it('mostra o estado vazio quando não há histórico', async () => {
    renderScreen();
    expect(await screen.findByText('Sem registros')).toBeTruthy();
  });

  it('agrupa o histórico por data e mostra o resumo de adesão', async () => {
    const today = localDateStr();
    const yesterday = localDateStr(new Date(Date.now() - 86_400_000));

    const doseToday: Dose = {
      id: 1,
      profileId: 1,
      scheduleId: 1,
      medicineId: 1,
      medicineName: 'Dipirona',
      dosage: '1 comprimido',
      scheduledTime: `${today}T08:00:00`,
      takenTime: `${today}T08:05:00`,
      status: 'taken',
    };
    const doseYesterday: Dose = {
      id: 2,
      profileId: 1,
      scheduleId: 2,
      medicineId: 2,
      medicineName: 'Vitamina C',
      dosage: '1 cápsula',
      scheduledTime: `${yesterday}T09:00:00`,
      status: 'skipped',
    };

    mockGetRecentHistory.mockResolvedValue([doseToday, doseYesterday]);
    mockUseWeekAdherence.mockReturnValue({
      data: [{ date: today, total: 2, taken: 1, rate: 0.5 }],
      isLoading: false,
    });

    renderScreen();

    expect(await screen.findByText('Dipirona')).toBeTruthy();
    expect(screen.getByText('Vitamina C')).toBeTruthy();
    expect(screen.getByText('Hoje')).toBeTruthy();
    expect(screen.getByText('Ontem')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('exporta o PDF com sucesso quando o compartilhamento está disponível', async () => {
    renderScreen();
    await screen.findByText('Sem registros');
    fireEvent.press(screen.getByLabelText('Exportar PDF'));

    await waitFor(() => {
      expect(mockGenerateAdherenceReport).toHaveBeenCalledWith(
        expect.objectContaining({ profileName: 'Perfil padrão' })
      );
      expect(mockPrintToFileAsync).toHaveBeenCalledWith({ html: '<html></html>' });
      expect(mockShareAsync).toHaveBeenCalledWith('file://report.pdf', {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    });
  });

  it('erro ao exportar mostra alerta e não trava a tela', async () => {
    mockGenerateAdherenceReport.mockRejectedValue(new Error('boom'));
    renderScreen();
    await screen.findByText('Sem registros');
    fireEvent.press(screen.getByLabelText('Exportar PDF'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro ao exportar', 'Não foi possível gerar o PDF.');
    });
    expect(screen.getByLabelText('Exportar PDF')).toBeTruthy();
  });
});
