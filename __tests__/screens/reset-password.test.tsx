import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import ResetPasswordScreen from '@/app/(auth)/reset-password';
import * as auth from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  updatePassword: jest.fn(),
  mapAuthError: jest.fn((e: any) => e.message ?? 'Erro inesperado. Tente novamente.'),
}));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('ResetPasswordScreen', () => {
  it('renderiza campos de nova senha e confirmação', () => {
    render(<ResetPasswordScreen />);
    expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeTruthy();
    expect(screen.getByPlaceholderText('Repita a nova senha')).toBeTruthy();
  });

  it('pressionar sem preencher não chama updatePassword', () => {
    render(<ResetPasswordScreen />);
    fireEvent.press(screen.getByTestId('btn-reset'));
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });

  it('mostra erro quando senhas não coincidem', async () => {
    render(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), 'diferente');
    fireEvent.press(screen.getByTestId('btn-reset'));

    await waitFor(() => {
      expect(screen.getByText(/senhas não coincidem/i)).toBeTruthy();
    });
  });

  it('mostra erro quando senha tem menos de 6 caracteres', async () => {
    render(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), '123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), '123');
    fireEvent.press(screen.getByTestId('btn-reset'));

    await waitFor(() => {
      expect(screen.getByText(/ao menos 6 caracteres/i)).toBeTruthy();
    });
  });

  it('chama updatePassword com a nova senha quando válida', async () => {
    (auth.updatePassword as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'novaSenha123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), 'novaSenha123');
    fireEvent.press(screen.getByTestId('btn-reset'));

    await waitFor(() => {
      expect(auth.updatePassword).toHaveBeenCalledWith('novaSenha123');
    });
  });

  it('navega para /login após redefinir com sucesso', async () => {
    (auth.updatePassword as jest.Mock).mockResolvedValueOnce(undefined);

    render(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'novaSenha123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), 'novaSenha123');
    fireEvent.press(screen.getByTestId('btn-reset'));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });
  });

  it('exibe erro da API quando updatePassword falha', async () => {
    (auth.updatePassword as jest.Mock).mockRejectedValueOnce({ message: 'Senha fraca demais.' });
    (auth.mapAuthError as jest.Mock).mockReturnValue('Senha fraca demais.');

    render(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'novaSenha123');
    fireEvent.changeText(screen.getByPlaceholderText('Repita a nova senha'), 'novaSenha123');
    fireEvent.press(screen.getByTestId('btn-reset'));

    await waitFor(() => {
      expect(screen.getByText('Senha fraca demais.')).toBeTruthy();
    });
  });
});
