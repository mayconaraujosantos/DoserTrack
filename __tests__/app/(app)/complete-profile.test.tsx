import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import CompleteProfileScreen from '@/app/(app)/complete-profile';

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
});

describe('CompleteProfileScreen', () => {
  it('renderiza os campos do formulário', () => {
    render(<CompleteProfileScreen />);

    expect(screen.getAllByText('Completar Perfil').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Nome completo')).toBeTruthy();
    expect(screen.getByPlaceholderText('+55 (00) 00000-0000')).toBeTruthy();
    expect(screen.getByText('Selecione')).toBeTruthy();
  });

  it('digitar nome e telefone atualiza os campos', () => {
    render(<CompleteProfileScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Maria Silva');
    fireEvent.changeText(screen.getByPlaceholderText('+55 (00) 00000-0000'), '11999998888');

    expect(screen.getByDisplayValue('Maria Silva')).toBeTruthy();
    expect(screen.getByDisplayValue('11999998888')).toBeTruthy();
  });

  it('abrir o seletor de gênero e escolher uma opção atualiza o texto exibido', () => {
    render(<CompleteProfileScreen />);

    fireEvent.press(screen.getByText('Selecione'));
    expect(screen.getByText('Masculino')).toBeTruthy();
    expect(screen.getByText('Feminino')).toBeTruthy();
    expect(screen.getByText('Prefiro não dizer')).toBeTruthy();

    fireEvent.press(screen.getByText('Feminino'));

    expect(screen.getByText('Feminino')).toBeTruthy();
    expect(screen.queryByText('Masculino')).toBeNull();
  });

  it('botão voltar chama router.back()', () => {
    render(<CompleteProfileScreen />);

    fireEvent.press(screen.getByLabelText('Voltar'));

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('pressionar "Completar Perfil" navega para /', async () => {
    render(<CompleteProfileScreen />);

    const [, submitButton] = screen.getAllByText('Completar Perfil');
    fireEvent.press(submitButton);

    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('pressionar "Pular por agora" navega para /', () => {
    render(<CompleteProfileScreen />);

    fireEvent.press(screen.getByText('Pular por agora'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
