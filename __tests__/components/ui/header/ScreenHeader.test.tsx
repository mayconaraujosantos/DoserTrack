import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScreenHeader } from '@/components/ui/header/ScreenHeader';

describe('ScreenHeader', () => {
  it('renderiza o título', () => {
    render(<ScreenHeader title="Medicamentos" />);
    expect(screen.getByText('Medicamentos')).toBeTruthy();
  });

  it('renderiza o subtítulo apenas quando informado', () => {
    render(<ScreenHeader title="Medicamentos" />);
    expect(screen.queryByText('3 ativos')).toBeNull();

    render(<ScreenHeader title="Medicamentos" subtitle="3 ativos" />);
    expect(screen.getByText('3 ativos')).toBeTruthy();
  });

  it('renderiza os slots left e right quando fornecidos', () => {
    render(
      <ScreenHeader
        title="Medicamentos"
        left={<Text>Voltar</Text>}
        right={<Text>Adicionar</Text>}
      />
    );
    expect(screen.getByText('Voltar')).toBeTruthy();
    expect(screen.getByText('Adicionar')).toBeTruthy();
  });
});
