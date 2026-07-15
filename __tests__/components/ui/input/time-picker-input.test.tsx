import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TimePickerInput } from '@/components/ui/input/time-picker-input';

describe('TimePickerInput', () => {
  it('renderiza o label e o horário informado', () => {
    render(<TimePickerInput label="Horário" value="08:30" onChange={jest.fn()} />);
    expect(screen.getByText('Horário')).toBeTruthy();
    expect(screen.getByText('08:30')).toBeTruthy();
  });

  it('usa 08:00 como fallback quando value está vazio', () => {
    render(<TimePickerInput label="Horário" value="" onChange={jest.fn()} />);
    expect(screen.getByText('08:00')).toBeTruthy();
  });

  it('abre o seletor nativo ao tocar no botão', () => {
    render(<TimePickerInput label="Horário" value="08:30" onChange={jest.fn()} />);
    expect(() => fireEvent.press(screen.getByText('08:30'))).not.toThrow();
  });
});
