import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, AppState } from 'react-native';
import { Stack } from 'expo-router';
import AppLayout from '@/app/(app)/_layout';
import { onAuthStateChange } from '@/lib/auth';
import { authenticate, isBiometricsEnabled } from '@/lib/biometrics';
import { initDatabase, resolveProfile, setActiveProfileId } from '@/lib/database';
import { requestNotificationPermissions } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import type { Profile } from '@/types';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  };
  function MockStack({ children }: Readonly<{ children?: React.ReactNode }>) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  MockStack.Screen = jest.fn(() => null);
  return {
    useRouter: jest.fn(() => mockRouter),
    Stack: MockStack,
  };
});

jest.mock('@/lib/auth', () => ({
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
}));

jest.mock('@/lib/biometrics', () => ({
  authenticate: jest.fn(() => Promise.resolve(true)),
  isBiometricsEnabled: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('@/lib/database', () => ({
  initDatabase: jest.fn(() => Promise.resolve()),
  resolveProfile: jest.fn(),
  setActiveProfileId: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  addNotificationResponseListener: jest.fn(() => ({ remove: jest.fn() })),
  checkOverdueDoses: jest.fn(() => Promise.resolve({ count: 0, doses: [] })),
  handleDoseNotificationAction: jest.fn(),
  requestNotificationPermissions: jest.fn(() => Promise.resolve(true)),
  rescheduleAllPendingDoses: jest.fn(() => Promise.resolve()),
  schedulePeriodicOverdueNotification: jest.fn(() => Promise.resolve()),
  setupNotificationHandler: jest.fn(),
}));

const mockQueryClient = { invalidateQueries: jest.fn() };
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => mockQueryClient),
}));

const testProfile: Profile = {
  id: 7,
  name: 'Ana',
  color: '#4A90D9',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({ dbReady: false, activeProfile: null });
  (resolveProfile as jest.Mock).mockResolvedValue(testProfile);
  (initDatabase as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AppLayout', () => {
  it('inicializa o banco e o perfil ativo, e renderiza a navegação principal', async () => {
    render(<AppLayout />);

    await waitFor(() => {
      expect(useAppStore.getState().dbReady).toBe(true);
    });

    expect(initDatabase).toHaveBeenCalled();
    expect(setActiveProfileId).toHaveBeenCalledWith(testProfile.id);
    expect(useAppStore.getState().activeProfile).toEqual(testProfile);
    expect(requestNotificationPermissions).toHaveBeenCalled();
    expect(onAuthStateChange).toHaveBeenCalled();
    expect((Stack.Screen as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('mostra a tela de erro quando initDatabase falha, e "Tentar novamente" reinicia o fluxo', async () => {
    (initDatabase as jest.Mock).mockRejectedValueOnce(new Error('falha ao abrir banco'));

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao abrir o banco de dados')).toBeTruthy();
    });
    expect(useAppStore.getState().dbReady).toBe(false);

    fireEvent.press(screen.getByText('Tentar novamente'));

    await waitFor(() => {
      expect(useAppStore.getState().dbReady).toBe(true);
    });
    expect(screen.queryByText('Erro ao abrir o banco de dados')).toBeNull();
    expect(initDatabase).toHaveBeenCalledTimes(2);
  });

  it('bloqueia a tela com biometria ao retornar do background após o threshold, e desbloqueia ao autenticar', async () => {
    jest.useFakeTimers();
    let appStateCallback: (state: string) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      appStateCallback = cb as unknown as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    (isBiometricsEnabled as jest.Mock).mockResolvedValue(true);
    let resolveAuth: (value: boolean) => void = () => undefined;
    (authenticate as jest.Mock).mockImplementation(
      () =>
        new Promise<boolean>(resolve => {
          resolveAuth = resolve;
        })
    );

    render(<AppLayout />);
    await waitFor(() => {
      expect(useAppStore.getState().dbReady).toBe(true);
    });

    await act(async () => {
      appStateCallback('background');
    });
    jest.advanceTimersByTime(6_000);
    await act(async () => {
      appStateCallback('active');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    await act(async () => {
      resolveAuth(true);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    });
  });
});
