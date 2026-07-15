import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Input } from '@/components/ui/input/Input';

describe('Input', () => {
  it('renderiza o label e propaga o texto digitado', () => {
    const onChangeText = jest.fn();
    render(<Input label="E-mail" placeholder="seu@email.com" onChangeText={onChangeText} />);
    expect(screen.getByText('E-mail')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'a@b.com');
    expect(onChangeText).toHaveBeenCalledWith('a@b.com');
  });

  it('não renderiza mensagem de erro quando não há erro', () => {
    render(<Input placeholder="Nome" />);
    expect(screen.queryByText('Campo obrigatório')).toBeNull();
  });

  it('renderiza a mensagem de erro quando informada', () => {
    render(<Input placeholder="Nome" error="Campo obrigatório" />);
    expect(screen.getByText('Campo obrigatório')).toBeTruthy();
  });

  it('renderiza o accessory à direita quando informado', () => {
    render(<Input placeholder="Quantidade" accessory={<Text>unidades</Text>} />);
    expect(screen.getByText('unidades')).toBeTruthy();
  });
});
