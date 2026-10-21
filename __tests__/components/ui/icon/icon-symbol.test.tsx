import React from 'react';
import { render } from '@testing-library/react-native';
import { IconSymbol } from '@/components/ui/icon/icon-symbol';

// Sob Jest (plataforma iOS por padrão no jest-expo), a resolução de módulo
// pega `icon-symbol.ios.tsx` (SFSymbol nativo via SymbolView), não o fallback
// `.tsx` de MaterialIcons usado no Android/web.
function flattenLayers(style: unknown): Record<string, unknown>[] {
  if (Array.isArray(style)) return style.flatMap(flattenLayers);
  return style ? [style as Record<string, unknown>] : [];
}
function flattenStyle(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...flattenLayers(style));
}

describe('IconSymbol', () => {
  it('repassa name, color e size para a SymbolView nativa', () => {
    const { toJSON } = render(<IconSymbol name="house.fill" color="#123456" size={30} />);
    const tree = toJSON() as { props: Record<string, unknown> };
    expect(tree.props.name).toBe('house.fill');
    expect(tree.props.tintColor).toBe('#123456');
    expect(flattenStyle(tree.props.style)).toMatchObject({ width: 30, height: 30 });
  });

  it('usa 24 como tamanho padrão', () => {
    const { toJSON } = render(<IconSymbol name="house.fill" color="#000" />);
    const tree = toJSON() as { props: Record<string, unknown> };
    expect(flattenStyle(tree.props.style)).toMatchObject({ width: 24, height: 24 });
  });
});
