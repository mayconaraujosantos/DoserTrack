import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Collapsible } from '@/components/ui/collapsible/collapsible';

describe('Collapsible', () => {
  it('inicia fechado, escondendo o conteúdo', () => {
    render(
      <Collapsible title="Detalhes">
        <Text>Conteúdo escondido</Text>
      </Collapsible>
    );
    expect(screen.getByText('Detalhes')).toBeTruthy();
    expect(screen.queryByText('Conteúdo escondido')).toBeNull();
  });

  it('mostra o conteúdo ao tocar no título, e esconde de novo ao tocar outra vez', () => {
    render(
      <Collapsible title="Detalhes">
        <Text>Conteúdo escondido</Text>
      </Collapsible>
    );

    fireEvent.press(screen.getByText('Detalhes'));
    expect(screen.getByText('Conteúdo escondido')).toBeTruthy();

    fireEvent.press(screen.getByText('Detalhes'));
    expect(screen.queryByText('Conteúdo escondido')).toBeNull();
  });
});
