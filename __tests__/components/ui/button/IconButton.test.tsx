import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { IconButton } from '@/components/ui/button/IconButton';

describe('IconButton', () => {
  it('chama onPress ao ser pressionado', () => {
    const onPress = jest.fn();
    render(<IconButton name="trash" onPress={onPress} accessibilityLabel="Excluir" />);
    fireEvent.press(screen.getByLabelText('Excluir'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('usa 44dp como tamanho mínimo de toque por padrão', () => {
    render(<IconButton name="trash" onPress={jest.fn()} accessibilityLabel="Excluir" />);
    const button = screen.getByLabelText('Excluir');
    const style = button.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.width).toBe(44);
    expect(flatStyle.height).toBe(44);
  });

  it('permite sobrescrever boxSize conscientemente', () => {
    render(
      <IconButton name="trash" onPress={jest.fn()} accessibilityLabel="Excluir" boxSize={32} />
    );
    const button = screen.getByLabelText('Excluir');
    const style = button.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.width).toBe(32);
    expect(flatStyle.height).toBe(32);
  });
});
