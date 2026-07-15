import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AdherenceWidget } from '@/components/ui/widget/adherence-widget';
import { useAdherenceStreak, useWeekAdherence } from '@/hooks/use-adherence';
import { localDateStr } from '@/lib/date';

jest.mock('@/hooks/use-adherence', () => ({
  useWeekAdherence: jest.fn(),
  useAdherenceStreak: jest.fn(),
}));

const mockUseWeekAdherence = useWeekAdherence as jest.Mock;
const mockUseAdherenceStreak = useAdherenceStreak as jest.Mock;

describe('AdherenceWidget', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T10:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('não renderiza nada quando não há semana nem streak', () => {
    mockUseWeekAdherence.mockReturnValue({ data: [] });
    mockUseAdherenceStreak.mockReturnValue({ data: 0 });

    const { toJSON } = render(<AdherenceWidget />);
    expect(toJSON()).toBeNull();
  });

  it('renderiza o streak e o rótulo no plural quando > 1', () => {
    mockUseWeekAdherence.mockReturnValue({ data: [] });
    mockUseAdherenceStreak.mockReturnValue({ data: 3 });

    render(<AdherenceWidget />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('dias consecutivos')).toBeTruthy();
  });

  it('renderiza o rótulo no singular quando streak == 1', () => {
    mockUseWeekAdherence.mockReturnValue({ data: [] });
    mockUseAdherenceStreak.mockReturnValue({ data: 1 });

    render(<AdherenceWidget />);
    expect(screen.getByText('dia consecutivo')).toBeTruthy();
  });

  it('expõe o percentual de adesão do dia via accessibilityLabel', () => {
    const today = localDateStr(new Date('2026-07-07T10:00:00'));
    mockUseWeekAdherence.mockReturnValue({
      data: [{ date: today, total: 2, taken: 1, rate: 0.5 }],
    });
    mockUseAdherenceStreak.mockReturnValue({ data: 2 });

    render(<AdherenceWidget />);
    expect(screen.getByLabelText(/50% de adesão/)).toBeTruthy();
  });
});
