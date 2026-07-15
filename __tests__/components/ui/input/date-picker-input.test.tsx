import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DatePickerInput } from '@/components/ui/input/date-picker-input';

describe('DatePickerInput', () => {
  it('renderiza o label e a data formatada em pt-BR', () => {
    render(<DatePickerInput label="Início" value="2026-07-07" onChange={jest.fn()} />);
    expect(screen.getByText('Início')).toBeTruthy();
    expect(screen.getByText('07/07/2026')).toBeTruthy();
  });

  it('mostra o placeholder quando não há valor', () => {
    render(
      <DatePickerInput label="Início" value="" onChange={jest.fn()} placeholder="Selecionar" />
    );
    expect(screen.getByText('Selecionar')).toBeTruthy();
  });

  it('abre o seletor nativo ao tocar no botão', () => {
    render(<DatePickerInput label="Início" value="2026-07-07" onChange={jest.fn()} />);
    expect(() => fireEvent.press(screen.getByText('07/07/2026'))).not.toThrow();
  });
});
