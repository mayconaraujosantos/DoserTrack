import React from 'react';
import { render } from '@testing-library/react-native';
import { Tabs } from 'expo-router';
import TabLayout from '@/app/(app)/(tabs)/_layout';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  function MockTabs({ children }: Readonly<{ children?: React.ReactNode }>) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  MockTabs.Screen = jest.fn(() => null);
  return { Tabs: MockTabs };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TabLayout', () => {
  it('renderiza sem quebrar', () => {
    expect(() => render(<TabLayout />)).not.toThrow();
  });

  it('configura as abas esperadas com título e opções corretas', () => {
    render(<TabLayout />);

    const calls = (Tabs.Screen as jest.Mock).mock.calls.map(([props]) => props);
    const names = calls.map(p => p.name);
    expect(names).toEqual(['index', 'medicines', 'schedule', 'history', 'schedules-list']);

    const byName = Object.fromEntries(calls.map(p => [p.name, p]));
    expect(byName.index.options.title).toBe('Hoje');
    expect(byName.medicines.options.title).toBe('Remédios');
    expect(byName.schedule.options.title).toBe('Agenda');
    expect(byName.history.options.title).toBe('Histórico');
    expect(byName.history.options.href).toBeNull();
    expect(byName['schedules-list'].options.title).toBe('Agendamentos');
  });
});
