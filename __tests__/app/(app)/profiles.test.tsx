import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilesScreen from '@/app/(app)/profiles';
import { signOut } from '@/lib/auth';
import {
  authenticate,
  isBiometricsAvailable,
  isBiometricsEnabled,
  setBiometricsEnabled,
} from '@/lib/biometrics';
import { createProfile, getProfiles, setActiveProfileId } from '@/lib/database';
import { setStoredActiveProfileId } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import type { Profile } from '@/types';

jest.mock('@/lib/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/biometrics', () => ({
  authenticate: jest.fn(() => Promise.resolve(true)),
  isBiometricsAvailable: jest.fn(() => Promise.resolve(false)),
  isBiometricsEnabled: jest.fn(() => Promise.resolve(false)),
  setBiometricsEnabled: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/database', () => ({
  createProfile: jest.fn(),
  getProfiles: jest.fn(),
  setActiveProfileId: jest.fn(),
}));

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

const profileA: Profile = {
  id: 1,
  name: 'Ana',
  color: '#4A90D9',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const profileB: Profile = {
  id: 2,
  name: 'Beto',
  color: '#27AE60',
  isDefault: false,
  createdAt: '2026-01-02T00:00:00.000Z',
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
  (getProfiles as jest.Mock).mockResolvedValue([profileA, profileB]);
  useAppStore.setState({ dbReady: true, activeProfile: profileA });
});

describe('ProfilesScreen', () => {
  it('renderiza a lista de perfis cadastrados, marcando o ativo', async () => {
    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
    });
    expect(screen.getByText('Beto')).toBeTruthy();
    expect(screen.getByLabelText('Perfil Ana, ativo')).toBeTruthy();
    expect(screen.getByLabelText('Perfil Beto')).toBeTruthy();
  });

  it('mostra estado vazio quando não há perfis', async () => {
    (getProfiles as jest.Mock).mockResolvedValue([]);

    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum perfil encontrado.')).toBeTruthy();
    });
  });

  it('selecionar um perfil inativo ativa e volta para a tela anterior', async () => {
    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Beto')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Perfil Beto'));

    await waitFor(() => {
      expect(setActiveProfileId).toHaveBeenCalledWith(profileB.id);
    });
    expect(setStoredActiveProfileId).toHaveBeenCalledWith(profileB.id);
    expect(useAppStore.getState().activeProfile).toEqual(profileB);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('cria um novo perfil com o nome digitado e o ativa', async () => {
    const newProfile: Profile = {
      id: 3,
      name: 'Carla',
      color: '#F39C12',
      isDefault: false,
      createdAt: '2026-01-03T00:00:00.000Z',
    };
    (createProfile as jest.Mock).mockResolvedValue(newProfile);

    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Ex: Mãe, Pai, João'), 'Carla');
    fireEvent.press(screen.getByLabelText('Criar perfil'));

    await waitFor(() => {
      expect(createProfile).toHaveBeenCalledWith({ name: 'Carla', color: expect.any(String) });
    });
    await waitFor(() => {
      expect(setActiveProfileId).toHaveBeenCalledWith(newProfile.id);
    });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('não cria perfil quando o nome está vazio', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Criar perfil'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Digite um nome para o perfil.');
    });
    expect(createProfile).not.toHaveBeenCalled();
  });

  it('alterna a biometria quando disponível', async () => {
    (isBiometricsAvailable as jest.Mock).mockResolvedValue(true);
    (isBiometricsEnabled as jest.Mock).mockResolvedValue(false);

    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Biometria')).toBeTruthy();
    });

    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', true);
    });

    await waitFor(() => {
      expect(authenticate).toHaveBeenCalled();
    });
    expect(setBiometricsEnabled).toHaveBeenCalledWith(true);
  });

  it('pressionar "Sair da conta" e confirmar chama signOut', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find(b => b.text === 'Sair');
      confirm?.onPress?.();
    });

    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sair da conta')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sair da conta'));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
  });

  it('pressionar "Política de Privacidade" navega para a tela correspondente', async () => {
    renderWithClient(<ProfilesScreen />);

    await waitFor(() => {
      expect(screen.getByText('Política de Privacidade')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Política de Privacidade'));

    expect(mockRouter.push).toHaveBeenCalledWith('/privacy-policy');
  });
});
