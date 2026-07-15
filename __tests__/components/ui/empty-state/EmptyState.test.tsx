import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';

describe('EmptyState', () => {
  it('renderiza título e descrição', () => {
    render(
      <EmptyState icon="medkit" title="Nenhum medicamento" description="Adicione o primeiro" />
    );
    expect(screen.getByText('Nenhum medicamento')).toBeTruthy();
    expect(screen.getByText('Adicione o primeiro')).toBeTruthy();
  });

  it('não renderiza o botão de ação quando actionLabel/onAction não são passados', () => {
    render(<EmptyState icon="medkit" title="Nenhum medicamento" />);
    expect(screen.queryByText('Adicionar')).toBeNull();
  });

  it('renderiza o botão de ação e chama onAction ao pressionar', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        icon="medkit"
        title="Nenhum medicamento"
        actionLabel="Adicionar"
        onAction={onAction}
      />
    );
    fireEvent.press(screen.getByText('Adicionar'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
