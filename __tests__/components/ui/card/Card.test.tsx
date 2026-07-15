import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '@/components/ui/card/Card';

describe('Card', () => {
  it('renderiza os filhos', () => {
    render(
      <Card>
        <Text>Conteúdo</Text>
      </Card>
    );
    expect(screen.getByText('Conteúdo')).toBeTruthy();
  });

  it('variant="outlined" usa borda mais grossa que o padrão', () => {
    render(
      <Card variant="outlined" testID="card">
        <Text>x</Text>
      </Card>
    );
    const flatStyle = Object.assign({}, ...screen.getByTestId('card').props.style);
    expect(flatStyle.borderWidth).toBe(1.5);
  });

  it('respeita o padding customizado', () => {
    render(
      <Card padding={30} testID="card">
        <Text>x</Text>
      </Card>
    );
    const flatStyle = Object.assign({}, ...screen.getByTestId('card').props.style);
    expect(flatStyle.padding).toBe(30);
  });
});
