import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import ForgotPasswordScreen from '@/app/(auth)/forgot-password';
import * as auth from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  sendPasswordReset: jest.fn(),
  mapAuthError: jest.fn((e: any) => e.message ?? 'Erro inesperado. Tente novamente.'),
}));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('ForgotPasswordScreen', () => {
  it('renderiza campo de e-mail', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByPlaceholderText('seu@email.com')).toBeTruthy();
  });

  it('pressionar sem e-mail não chama sendPasswordReset', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByTestId('btn-send'));
    expect(auth.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('pressionar com e-mail inválido não chama sendPasswordReset', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'invalido');
    fireEvent.press(screen.getByTestId('btn-send'));
    expect(auth.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('exibe mensagem de sucesso após envio', async () => {
    (auth.sendPasswordReset as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'user@test.com');
    fireEvent.press(screen.getByTestId('btn-send'));

    await waitFor(() => {
      expect(screen.getByText('Verifique seu e-mail')).toBeTruthy();
    });
  });

  it('exibe mensagem de erro quando falha', async () => {
    (auth.sendPasswordReset as jest.Mock).mockRejectedValueOnce({
      code: 'user_not_found',
      message: 'E-mail não encontrado.',
    });
    (auth.mapAuthError as jest.Mock).mockReturnValue('E-mail não encontrado.');

    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'naoexiste@test.com');
    fireEvent.press(screen.getByTestId('btn-send'));

    await waitFor(() => {
      expect(screen.getByText('E-mail não encontrado.')).toBeTruthy();
    });
  });

  it('botão voltar chama router.back()', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.press(screen.getByLabelText('Voltar'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
