import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Index from '@/app/index';
import { hasSeenOnboarding } from '@/lib/storage';
import { getSession } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  getSession: jest.fn(),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('Index (route guard)', () => {
  it('redireciona para /onboarding quando onboarding ainda não foi visto', async () => {
    (hasSeenOnboarding as jest.Mock).mockResolvedValueOnce(false);

    render(<Index />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('redireciona para /(app)/(tabs) quando há sessão ativa', async () => {
    (hasSeenOnboarding as jest.Mock).mockResolvedValueOnce(true);
    (getSession as jest.Mock).mockResolvedValueOnce({
      user: { id: '1', email: 'a@a.com' },
    });

    render(<Index />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(tabs)');
    });
  });

  it('redireciona para /login quando não há sessão', async () => {
    (hasSeenOnboarding as jest.Mock).mockResolvedValueOnce(true);
    (getSession as jest.Mock).mockResolvedValueOnce(null);

    render(<Index />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('redireciona para /login quando getSession lança erro', async () => {
    (hasSeenOnboarding as jest.Mock).mockResolvedValueOnce(true);
    (getSession as jest.Mock).mockRejectedValueOnce(new Error('falha de rede'));

    render(<Index />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
  });
});
