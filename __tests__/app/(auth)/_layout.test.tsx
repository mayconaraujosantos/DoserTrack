import React from 'react';
import { render } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import AuthLayout from '@/app/(auth)/_layout';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  function MockStack({ children }: Readonly<{ children?: React.ReactNode }>) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  MockStack.Screen = jest.fn(() => null);
  return { Stack: MockStack };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuthLayout', () => {
  it('renderiza sem quebrar', () => {
    expect(() => render(<AuthLayout />)).not.toThrow();
  });

  it('configura as telas do fluxo de autenticação, na ordem esperada', () => {
    render(<AuthLayout />);

    const names = (Stack.Screen as jest.Mock).mock.calls.map(([props]) => props.name);
    expect(names).toEqual(['onboarding', 'login', 'register', 'forgot-password', 'reset-password']);
  });
});
