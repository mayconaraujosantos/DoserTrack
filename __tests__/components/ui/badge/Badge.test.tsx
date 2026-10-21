import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Badge } from '@/components/ui/badge/Badge';

describe('Badge', () => {
  it('renderiza o label recebido', () => {
    render(<Badge label="Em dia" />);
    expect(screen.getByText('Em dia')).toBeTruthy();
  });

  it('não renderiza o ponto indicador quando dot é omitido', () => {
    render(<Badge label="Pendente" testID="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.children).toHaveLength(1); // só o Text, sem a View do dot
  });

  it('renderiza o ponto indicador quando dot=true', () => {
    render(<Badge label="Atrasado" dot testID="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge.children).toHaveLength(2); // dot + Text
  });
});
