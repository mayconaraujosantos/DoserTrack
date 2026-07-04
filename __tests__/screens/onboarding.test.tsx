import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '@/app/(auth)/onboarding';
import * as storage from '@/lib/storage';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

async function skipSplash() {
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
}

describe('OnboardingScreen', () => {
  it('renderiza o título do primeiro slide após a splash', async () => {
    render(<OnboardingScreen />);
    await skipSplash();
    expect(screen.getByText('Bem-vindo ao DoserTrack')).toBeTruthy();
  });

  it('botão Próximo avança para o slide seguinte', async () => {
    render(<OnboardingScreen />);
    await skipSplash();
    fireEvent.press(screen.getByLabelText('Próximo slide'));
    expect(screen.getByText('Escaneie sua receita')).toBeTruthy();
  });

  it('botão "Pular" vai para o último slide', async () => {
    render(<OnboardingScreen />);
    await skipSplash();
    fireEvent.press(screen.getByText('Pular'));
    expect(screen.getByText('Nunca perca uma dose')).toBeTruthy();
  });

  it('último slide exibe botões "Criar conta" e "Já tenho conta"', async () => {
    render(<OnboardingScreen />);
    await skipSplash();
    fireEvent.press(screen.getByText('Pular'));
    expect(screen.getByText('Criar conta grátis')).toBeTruthy();
    expect(screen.getByText('Já tenho conta')).toBeTruthy();
  });

  it('"Criar conta" marca onboarding como visto e navega para /register', async () => {
    render(<OnboardingScreen />);
    await skipSplash();
    fireEvent.press(screen.getByText('Pular'));
    fireEvent.press(screen.getByText('Criar conta grátis'));
    await waitFor(() => {
      expect(storage.markOnboardingDone).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/register');
    });
  });

  it('"Já tenho conta" marca onboarding como visto e navega para /login', async () => {
    render(<OnboardingScreen />);
    await skipSplash();
    fireEvent.press(screen.getByText('Pular'));
    fireEvent.press(screen.getByText('Já tenho conta'));
    await waitFor(() => {
      expect(storage.markOnboardingDone).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
  });
});
