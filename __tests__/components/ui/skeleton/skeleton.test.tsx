import React from 'react';
import { render } from '@testing-library/react-native';
import {
  Skeleton,
  DoseCardSkeleton,
  MedicineCardSkeleton,
} from '@/components/ui/skeleton/skeleton';

describe('Skeleton', () => {
  it('renderiza sem quebrar com as dimensões informadas', () => {
    const { toJSON } = render(<Skeleton width={100} height={20} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('DoseCardSkeleton', () => {
  it('renderiza sem quebrar', () => {
    const { toJSON } = render(<DoseCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('MedicineCardSkeleton', () => {
  it('renderiza sem quebrar', () => {
    const { toJSON } = render(<MedicineCardSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
