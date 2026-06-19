import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import LoginScreen from '@/app/login';
import * as auth from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  signIn: jest.fn(),
  mapAuthError: jest.fn((e: any) => e.message ?? 'Erro inesperado. Tente novamente.'),
}));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('LoginScreen', () => {
  it('renderiza campos de e-mail e senha', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('seu@email.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('pressionar o botão sem e-mail/senha não chama signIn', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByTestId('btn-login'));
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('pressionar o botão com e-mail inválido não chama signIn', () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'nao-e-email');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'senha123');
    fireEvent.press(screen.getByTestId('btn-login'));
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('exibe erro quando login falha', async () => {
    (auth.signIn as jest.Mock).mockRejectedValueOnce({
      code: 'invalid_credentials',
      message: 'E-mail ou senha inválidos.',
    });
    (auth.mapAuthError as jest.Mock).mockReturnValue('E-mail ou senha inválidos.');

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'errada');
    fireEvent.press(screen.getByTestId('btn-login'));

    await waitFor(() => {
      expect(screen.getByText('E-mail ou senha inválidos.')).toBeTruthy();
    });
  });

  it('navega para /(tabs) quando login é bem-sucedido', async () => {
    (auth.signIn as jest.Mock).mockResolvedValueOnce({
      id: 'uid-1',
      email: 'user@test.com',
      displayName: 'Maria',
    });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'senha123');
    fireEvent.press(screen.getByTestId('btn-login'));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('link "Esqueci a senha" navega para /forgot-password', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Esqueci a senha'));
    expect(mockRouter.push).toHaveBeenCalledWith('/forgot-password');
  });

  it('link "Criar conta" navega para /register', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Criar conta'));
    expect(mockRouter.push).toHaveBeenCalledWith('/register');
  });
});
