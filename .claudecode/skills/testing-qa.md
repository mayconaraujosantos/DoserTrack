# Skill: Testing & Quality Assurance

## Overview

Comprehensive guide for writing tests, running test suites, and maintaining code quality in Doser.

## When to Use This Skill

- Writing unit tests before implementation
- Testing database operations
- Testing authentication flows
- Integration testing
- E2E testing
- Quality metrics and coverage

## Test Setup

### Test Configuration

```typescript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'hooks/**/*.ts',
    'components/**/*.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Test Setup File

```typescript
// __tests__/setup.ts
import '@testing-library/react-native/extend-expect';

// Mock native modules
jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(),
  openDatabaseAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
  })),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

// Mock React Native modules
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));
```

## Unit Tests

### Service Layer Tests

```typescript
// __tests__/services/medicines.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { medicineManager } from '@/lib/medicines';
import { database } from '@/lib/database';

describe('Medicine Service', () => {
  const profileId = 'test-profile';

  beforeEach(async () => {
    // Clear test data
    await database.medicines.deleteByProfile(profileId);
  });

  describe('Create Medicine', () => {
    it('should create a medicine with valid data', async () => {
      const medicine = await medicineManager.createMedicine(profileId, {
        name: 'Aspirin',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      expect(medicine).toBeDefined();
      expect(medicine.id).toBeDefined();
      expect(medicine.name).toBe('Aspirin');
      expect(medicine.profileId).toBe(profileId);
    });

    it('should reject empty medicine name', async () => {
      expect(async () => {
        await medicineManager.createMedicine(profileId, {
          name: '',
          strength: 100,
          unit: 'mg',
          form: 'tablet',
          frequency: 'daily',
          dosage: 1,
        });
      }).rejects.toThrow('Medicine name is required');
    });

    it('should reject invalid strength', async () => {
      expect(async () => {
        await medicineManager.createMedicine(profileId, {
          name: 'Aspirin',
          strength: -100,
          unit: 'mg',
          form: 'tablet',
          frequency: 'daily',
          dosage: 1,
        });
      }).rejects.toThrow('Strength must be positive');
    });
  });

  describe('Get Medicines', () => {
    it('should retrieve medicines for profile', async () => {
      await medicineManager.createMedicine(profileId, {
        name: 'Med1',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      const medicines = await medicineManager.getMedicinesByProfile(profileId);

      expect(medicines).toHaveLength(1);
      expect(medicines[0].name).toBe('Med1');
    });

    it('should isolate medicines by profile', async () => {
      const profile1 = 'profile-1';
      const profile2 = 'profile-2';

      await medicineManager.createMedicine(profile1, {
        name: 'Med1',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      await medicineManager.createMedicine(profile2, {
        name: 'Med2',
        strength: 200,
        unit: 'mg',
        form: 'capsule',
        frequency: 'weekly',
        dosage: 2,
      });

      const med1 = await medicineManager.getMedicinesByProfile(profile1);
      const med2 = await medicineManager.getMedicinesByProfile(profile2);

      expect(med1).toHaveLength(1);
      expect(med2).toHaveLength(1);
      expect(med1[0].name).toBe('Med1');
      expect(med2[0].name).toBe('Med2');
    });
  });

  describe('Update Medicine', () => {
    it('should update medicine', async () => {
      const medicine = await medicineManager.createMedicine(profileId, {
        name: 'Aspirin',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      const updated = await medicineManager.updateMedicine(medicine.id, {
        strength: 500,
      });

      expect(updated?.strength).toBe(500);
    });
  });

  describe('Delete Medicine', () => {
    it('should delete medicine', async () => {
      const medicine = await medicineManager.createMedicine(profileId, {
        name: 'Aspirin',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      await medicineManager.deleteMedicine(medicine.id);

      const found = await medicineManager.getMedicine(medicine.id);
      expect(found).toBeNull();
    });

    it('should delete related schedules', async () => {
      const medicine = await medicineManager.createMedicine(profileId, {
        name: 'Aspirin',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      const schedule = await scheduleManager.createSchedule(profileId, {
        medicineId: medicine.id,
        time: '08:00',
        daysOfWeek: [1, 2, 3],
        dosage: 1,
      });

      await medicineManager.deleteMedicine(medicine.id);

      const found = await scheduleManager.getSchedule(schedule.id);
      expect(found).toBeNull();
    });
  });

  describe('Search Medicines', () => {
    it('should search by name', async () => {
      await medicineManager.createMedicine(profileId, {
        name: 'Aspirin',
        strength: 100,
        unit: 'mg',
        form: 'tablet',
        frequency: 'daily',
        dosage: 1,
      });

      const results = await medicineManager.searchMedicines(profileId, 'Aspi');
      expect(results).toHaveLength(1);
    });

    it('should search by form', async () => {
      await medicineManager.createMedicine(profileId, {
        name: 'Ibuprofen',
        strength: 200,
        unit: 'mg',
        form: 'capsule',
        frequency: 'as-needed',
        dosage: 2,
      });

      const results = await medicineManager.searchMedicines(profileId, 'capsule');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      const results = await medicineManager.searchMedicines(profileId, 'nonexistent');
      expect(results).toHaveLength(0);
    });
  });
});
```

### Hook Tests

```typescript
// __tests__/hooks/useMedicines.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMedicines } from '@/hooks/useMedicines';
import { medicineManager } from '@/lib/medicines';

describe('useMedicines Hook', () => {
  it('should load medicines', async () => {
    const profileId = 'test-profile';

    await medicineManager.createMedicine(profileId, {
      name: 'Aspirin',
      strength: 100,
      unit: 'mg',
      form: 'tablet',
      frequency: 'daily',
      dosage: 1,
    });

    const { result } = renderHook(() => useMedicines(profileId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(1);
  });

  it('should not fetch if profile is null', () => {
    const { result } = renderHook(() => useMedicines(null));

    expect(result.current.isFetching).toBe(false);
  });
});
```

## Integration Tests

### Authentication Flow

```typescript
// __tests__/integration/auth-flow.test.ts
describe('Authentication Flow', () => {
  it('should complete sign-up and sign-in flow', async () => {
    const email = 'test@example.com';
    const password = 'TestPassword123!';

    // Sign up
    const signUpResult = await signUpWithEmail(email, password);
    expect(signUpResult.success).toBe(true);

    // Sign in
    const signInResult = await signInWithEmail(email, password);
    expect(signInResult.success).toBe(true);

    // Get current user
    const user = await getCurrentUser();
    expect(user?.email).toBe(email);

    // Sign out
    await signOut();
    const userAfterLogout = await getCurrentUser();
    expect(userAfterLogout).toBeNull();
  });
});
```

### Sync Flow

```typescript
// __tests__/integration/sync-flow.test.ts
describe('Sync Flow', () => {
  it('should sync local changes to remote', async () => {
    const profileId = 'test-profile';

    // Create local medicine
    const medicine = await medicineManager.createMedicine(profileId, {
      name: 'Aspirin',
      strength: 100,
      unit: 'mg',
      form: 'tablet',
      frequency: 'daily',
      dosage: 1,
    });

    // Run sync
    const result = await syncManager.sync(profileId);

    expect(result.success).toBe(true);
    expect(result.synced).toBeGreaterThan(0);
  });

  it('should handle offline and retry online', async () => {
    // Simulate offline
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({ isConnected: false });

    const medicine = await medicineManager.createMedicine(profileId, {
      name: 'Medicine',
      strength: 100,
      unit: 'mg',
      form: 'tablet',
      frequency: 'daily',
      dosage: 1,
    });

    // Should be queued
    let queued = await database.medicines.getUnsyncedByProfile(profileId);
    expect(queued.length).toBeGreaterThan(0);

    // Go back online
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({ isConnected: true });

    // Sync
    const result = await syncManager.sync(profileId);
    expect(result.success).toBe(true);

    // Should be synced
    queued = await database.medicines.getUnsyncedByProfile(profileId);
    expect(queued.length).toBe(0);
  });
});
```

## Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- __tests__/services/medicines.test.ts

# Run with coverage
npm test -- --coverage

# Run coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html

# Run integration tests only
npm test -- __tests__/integration

# Run unit tests only
npm test -- --testPathPattern='(?<!integration)\.test\.ts'
```

## Coverage Goals

- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >80%
- **Lines**: >80%

## Quality Checks

### Linting

```bash
npm run lint
npm run lint -- --fix
```

### Type Checking

```bash
npx tsc --noEmit
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write", "jest --bail --findRelatedTests"]
  }
}
```

## Testing Best Practices

1. **Write tests first** - TDD approach
2. **Test behavior** - Not implementation details
3. **Use descriptive names** - What you're testing should be clear
4. **Mock external dependencies** - Database, API, etc.
5. **Test edge cases** - Empty inputs, errors, etc.
6. **Isolate tests** - No dependencies between tests
7. **Clean up** - beforeEach/afterEach cleanup
8. **Test async code** - Use waitFor() for hooks
9. **Keep tests focused** - One behavior per test
10. **Aim for coverage** - But focus on critical paths

## Debugging Tests

### Debug Single Test

```typescript
it.only('should debug this test', async () => {
  // Only this test will run
});
```

### Add Debug Output

```typescript
import { screen, debug } from '@testing-library/react-native';

debug(); // Print debug tree
screen.debug(); // Print specific element
```

### Step Through in VS Code

```json
{
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-coverage"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```
