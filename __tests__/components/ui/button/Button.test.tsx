import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/button/Button';

describe('Button', () => {
  it('renderiza o texto e chama onPress ao ser pressionado', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Salvar</Button>);
    fireEvent.press(screen.getByText('Salvar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('não chama onPress quando disabled', () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} disabled testID="btn">
        Salvar
      </Button>
    );
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('não chama onPress e esconde o texto quando loading', () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} loading testID="btn">
        Salvar
      </Button>
    );
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Salvar')).toBeNull();
  });

  it('expõe accessibilityState refletindo disabled/busy', () => {
    render(
      <Button onPress={jest.fn()} loading testID="btn">
        Salvar
      </Button>
    );
    expect(screen.getByTestId('btn').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });
});
