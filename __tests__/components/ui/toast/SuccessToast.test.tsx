import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { SuccessToast } from '@/components/ui/toast/SuccessToast';

describe('SuccessToast', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('não renderiza nada quando visible=false', () => {
    render(<SuccessToast visible={false} title="Salvo" onHide={jest.fn()} />);
    expect(screen.queryByText('Salvo')).toBeNull();
  });

  it('renderiza título e mensagem quando visible=true', () => {
    render(
      <SuccessToast
        visible
        title="Salvo com sucesso"
        message="Dose registrada"
        onHide={jest.fn()}
      />
    );
    expect(screen.getByText('Salvo com sucesso')).toBeTruthy();
    expect(screen.getByText('Dose registrada')).toBeTruthy();
  });

  it('chama onHide sozinho após a duração configurada', () => {
    jest.useFakeTimers();
    const onHide = jest.fn();
    render(<SuccessToast visible title="Salvo" onHide={onHide} durationMs={1000} />);

    expect(onHide).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('renderiza o botão de ação e chama onAction + onHide ao pressionar', () => {
    const onAction = jest.fn();
    const onHide = jest.fn();
    render(
      <SuccessToast
        visible
        title="Estoque baixo"
        actionLabel="Repor"
        onAction={onAction}
        onHide={onHide}
      />
    );
    fireEvent.press(screen.getByText('Repor'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
