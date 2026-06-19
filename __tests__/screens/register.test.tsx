import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import RegisterScreen from '@/app/register';
import * as auth from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  signUp: jest.fn(),
  mapAuthError: jest.fn((e: any) => e.message ?? 'Erro inesperado. Tente novamente.'),
}));

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('RegisterScreen', () => {
  it('renderiza campos de nome, e-mail e senha', () => {
    render(<RegisterScreen />);
    expect(screen.getByPlaceholderText('Seu nome')).toBeTruthy();
    expect(screen.getByPlaceholderText('seu@email.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeTruthy();
  });

  it('pressionar Registrar sem campos não chama signUp', () => {
    render(<RegisterScreen />);
    fireEvent.press(screen.getByTestId('btn-register'));
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('mostra erro se senha tiver menos de 6 caracteres', async () => {
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Seu nome'), 'Maria Silva');
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'maria@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), '123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Registrar'));

    await waitFor(() => {
      expect(screen.getByText(/ao menos 6 caracteres/i)).toBeTruthy();
    });
  });

  it('mostra erro se e-mail for inválido', async () => {
    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Seu nome'), 'Maria Silva');
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'nao-e-email');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByText('Registrar'));

    await waitFor(() => {
      expect(screen.getByText(/e-mail válido/i)).toBeTruthy();
    });
  });

  it('exibe erro quando e-mail já está cadastrado', async () => {
    (auth.signUp as jest.Mock).mockRejectedValueOnce({
      code: 'user_already_exists',
      message: 'Este e-mail já está cadastrado.',
    });
    (auth.mapAuthError as jest.Mock).mockReturnValue('Este e-mail já está cadastrado.');

    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Seu nome'), 'Maria Silva');
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'existente@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByTestId('btn-register'));

    await waitFor(() => {
      expect(screen.getByText('Este e-mail já está cadastrado.')).toBeTruthy();
    });
  });

  it('navega para /(tabs) quando cadastro é bem-sucedido', async () => {
    (auth.signUp as jest.Mock).mockResolvedValueOnce({
      id: 'uid-1',
      email: 'novo@test.com',
      displayName: 'Maria Silva',
    });

    render(<RegisterScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Seu nome'), 'Maria Silva');
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'novo@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(screen.getByRole('checkbox'));
    fireEvent.press(screen.getByTestId('btn-register'));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('link "Já tenho conta" navega para /login', () => {
    render(<RegisterScreen />);
    fireEvent.press(screen.getByTestId('link-login'));
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });
});
