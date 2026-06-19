# Code Style Guide - Doser

## TypeScript

### Type Definitions

```typescript
// ✅ DO: Explicit types
function calculateDose(medicineId: string, profileId: string): Promise<number> {
  // ...
}

// ❌ DON'T: Implicit any
function calculateDose(medicineId, profileId) {
  // ...
}

// ✅ DO: Use interfaces for object contracts
interface Medicine {
  id: string;
  name: string;
  strength: number;
  unit: string;
  profileId: string;
}

// ✅ DO: Use types for unions and complex types
type MedicineStatus = 'active' | 'archived' | 'discontinued';
type OperationResult<T> = { success: true; data: T } | { success: false; error: string };
```

### Naming Conventions

```typescript
// Constants: SCREAMING_SNAKE_CASE
const MAX_MEDICINES_PER_PROFILE = 100;
const DEFAULT_REMINDER_TIME = '08:00';

// Types/Interfaces: PascalCase
interface UserProfile {}
type DoseStatus = 'pending' | 'taken' | 'skipped';

// Functions/Variables: camelCase
function getMedicinesByProfile(profileId: string): Promise<Medicine[]> {}
let currentProfileId: string;

// Private/Internal: Leading underscore
function _validateMedicineData(data: unknown): boolean {}
```

## React Components

### Functional Components

```typescript
// ✅ DO: Typed props interface
interface MedicineCardProps {
  medicine: Medicine;
  onPress: () => void;
  loading?: boolean;
}

export function MedicineCard({ medicine, onPress, loading = false }: MedicineCardProps) {
  return (
    // Component JSX
  );
}

// ✅ DO: Export named component
export function MyComponent() { }

// ❌ DON'T: Default exports for screens/components
export default function MyComponent() { }
```

### Hooks

```typescript
// ✅ DO: Custom hooks with 'use' prefix
export function useMedicines(profileId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['medicines', profileId],
    queryFn: () => getMedicinesByProfile(profileId),
  });
}

// ✅ DO: Memoize when appropriate
export const MedicineItem = React.memo(function MedicineItem({ medicine }: MedicineItemProps) {
  return <Text>{medicine.name}</Text>;
});
```

## File Structure

### Screen Files

```typescript
// app/medicines.tsx
import { useState } from 'react';
import { View, FlatList } from 'react-native';
import { MedicineCard } from '@/components/MedicineCard';
import { useMedicines } from '@/hooks/useMedicines';

export default function MedicinesScreen() {
  const { data: medicines, isLoading } = useMedicines('profile-123');

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={medicines}
        renderItem={({ item }) => <MedicineCard medicine={item} />}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}
```

### Component Files

```typescript
// components/MedicineCard.tsx
import React from 'react';
import { Pressable, Text } from 'react-native';
import { Medicine } from '@/types';

interface MedicineCardProps {
  medicine: Medicine;
  onPress?: () => void;
}

export const MedicineCard = React.memo(function MedicineCard({
  medicine,
  onPress,
}: MedicineCardProps) {
  return (
    <Pressable onPress={onPress}>
      <Text>{medicine.name}</Text>
    </Pressable>
  );
});

MedicineCard.displayName = 'MedicineCard';
```

### Library/Service Files

```typescript
// lib/database.ts - Services follow this pattern
async function getMedicinesByProfile(profileId: string): Promise<Medicine[]> {
  try {
    // Implementation
    return results;
  } catch (error) {
    console.error('Failed to get medicines:', error);
    throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

export const database = {
  medicines: {
    getByProfile: getMedicinesByProfile,
    create: createMedicine,
    update: updateMedicine,
    delete: deleteMedicine,
  },
};
```

## Error Handling

### Try-Catch Pattern

```typescript
// ✅ DO: Explicit error handling
async function fetchMedicines(profileId: string): Promise<Medicine[]> {
  try {
    const result = await database.medicines.getByProfile(profileId);
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error('Database error:', error.message);
      throw new Error('Failed to load medicines. Please try again.');
    }
    throw error;
  }
}

// ❌ DON'T: Silent error swallowing
async function fetchMedicines(profileId: string): Promise<Medicine[]> {
  try {
    return await database.medicines.getByProfile(profileId);
  } catch (error) {
    return []; // Silent failure
  }
}
```

### React Query Error Handling

```typescript
const { data, isError, error } = useQuery({
  queryKey: ['medicines', profileId],
  queryFn: async () => {
    try {
      return await getMedicines(profileId);
    } catch (error) {
      throw new Error('Failed to load medicines');
    }
  },
  retry: 2,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
});

if (isError) {
  return <ErrorMessage message={error.message} />;
}
```

## Async Operations

### Promise Pattern

```typescript
// ✅ DO: Use async/await
async function loadData(): Promise<Data> {
  const data = await fetchData();
  const processed = process(data);
  return processed;
}

// ✅ DO: Handle cleanup with finally
async function fetchWithTimeout(): Promise<void> {
  const controller = new AbortController();
  try {
    await fetch(url, { signal: controller.signal });
  } finally {
    controller.abort();
  }
}
```

### Multiple Async Operations

```typescript
// ✅ DO: Wait for parallel operations when independent
const [medicines, schedules] = await Promise.all([
  getMedicines(profileId),
  getSchedules(profileId),
]);

// ✅ DO: Wait for sequential operations when dependent
const medicines = await getMedicines(profileId);
const withSchedules = await Promise.all(medicines.map(m => getSchedules(m.id)));
```

## State Management

### Zustand Store Pattern

```typescript
// lib/store.ts
import { create } from 'zustand';

interface AppState {
  activeProfileId: string | null;
  isAuthenticated: boolean;
  setActiveProfile: (profileId: string) => void;
  setAuthenticated: (value: boolean) => void;
}

export const useAppStore = create<AppState>(set => ({
  activeProfileId: null,
  isAuthenticated: false,
  setActiveProfile: (profileId: string) => set({ activeProfileId: profileId }),
  setAuthenticated: (value: boolean) => set({ isAuthenticated: value }),
}));
```

### React Query Pattern

```typescript
// hooks/useMedicines.ts
export function useMedicines(profileId: string | null) {
  return useQuery({
    queryKey: ['medicines', profileId],
    queryFn: () => (profileId ? getMedicinesByProfile(profileId) : Promise.resolve([])),
    enabled: !!profileId, // Don't query if no profile
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

## Comments & Documentation

### JSDoc for Public Functions

```typescript
/**
 * Retrieves medicines for a given profile.
 *
 * @param profileId - The ID of the profile
 * @returns A promise resolving to an array of medicines
 * @throws DatabaseError if the query fails
 *
 * @example
 * const medicines = await getMedicinesByProfile('profile-123');
 */
export async function getMedicinesByProfile(profileId: string): Promise<Medicine[]> {
  // ...
}
```

### Inline Comments for Complex Logic

```typescript
// Only show sync button if data is stale and device is connected
const shouldShowSync = isDataStale && isConnected && !isSyncing;

// Complex calculations deserve explanation
const nextDoseTime = new Date(lastDoseTime.getTime() + frequencyMinutes * 60 * 1000);
```

### Avoid Obvious Comments

```typescript
// ❌ DON'T: Obvious
let count = 0; // Initialize count to 0

// ✅ DO: Only when non-obvious
let tokenRefreshAttempts = 0; // Retry up to 3 times before forcing logout
```

## Imports

### Organization

```typescript
// 1. External libraries
import React, { useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';

// 2. Local absolute imports
import { Medicine } from '@/types';
import { MedicineCard } from '@/components/MedicineCard';
import { useMedicines } from '@/hooks/useMedicines';

// 3. Local relative imports (if necessary)
import { helpers } from './helpers';
```

### Alias Usage

```typescript
// tsconfig.json or Expo setup should define:
// "@/*": "src/*"

// Then use:
import { MyComponent } from '@/components/MyComponent';

// Not:
import { MyComponent } from '../../../components/MyComponent';
```

## Performance Patterns

### Memoization

```typescript
// ✅ DO: Memoize expensive components
export const MedicineList = React.memo(
  function MedicineList({ medicines }: MedicineListProps) {
    return (
      <FlatList data={medicines} renderItem={...} />
    );
  },
  (prev, next) => prev.medicines === next.medicines
);

// ✅ DO: Memoize callbacks
const handlePress = useCallback(() => {
  // ...
}, [dependency]);
```

### List Rendering

```typescript
// ✅ DO: Use FlatList for large lists with proper keys
<FlatList
  data={medicines}
  renderItem={({ item }) => <MedicineCard medicine={item} />}
  keyExtractor={(item) => item.id}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
/>

// ❌ DON'T: map() for large lists
{medicines.map((m) => <MedicineCard key={m.id} medicine={m} />)}
```

## Testing

### Test File Location & Naming

```typescript
// components/MedicineCard.tsx
// __tests__/MedicineCard.test.tsx

import { render, screen } from '@testing-library/react-native';
import { MedicineCard } from '@/components/MedicineCard';

describe('MedicineCard', () => {
  it('renders medicine name', () => {
    const medicine = { id: '1', name: 'Aspirin', strength: 100, unit: 'mg', profileId: 'p1' };
    render(<MedicineCard medicine={medicine} />);
    expect(screen.getByText('Aspirin')).toBeTruthy();
  });
});
```

## Formatting

### Prettier Config (recommended)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

### Line Length

- Max 100 characters (configurable)
- Break long lines at logical points

### Indentation

- 2 spaces (not tabs)
- Consistent throughout

## Linting

Use ESLint rules from `eslint.config.js`:

- No unused variables
- Consistent naming
- No console logs in production
- No debugger statements
