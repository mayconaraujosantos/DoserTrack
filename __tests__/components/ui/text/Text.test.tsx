import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from '@/components/ui/text/Text';

function flattenLayers(style: unknown): Record<string, unknown>[] {
  if (Array.isArray(style)) return style.flatMap(flattenLayers);
  return style ? [style as Record<string, unknown>] : [];
}
function flattenStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...flattenLayers(style));
}

describe('Text', () => {
  it('renderiza os filhos', () => {
    render(<Text>Olá</Text>);
    expect(screen.getByText('Olá')).toBeTruthy();
  });

  it('aplica o tamanho de fonte da variante "heading"', () => {
    render(<Text variant="heading">Título</Text>);
    const flat = flattenStyle(screen.getByText('Título').props.style);
    expect(flat.fontSize).toBe(26);
  });

  it('usa a variante "body" por padrão', () => {
    render(<Text>Texto</Text>);
    const flat = flattenStyle(screen.getByText('Texto').props.style);
    expect(flat.fontSize).toBe(15);
  });

  it('permite sobrescrever a cor padrão da variante', () => {
    render(
      <Text variant="label" color="#ff0000">
        Rótulo
      </Text>
    );
    const flat = flattenStyle(screen.getByText('Rótulo').props.style);
    expect(flat.color).toBe('#ff0000');
  });
});
