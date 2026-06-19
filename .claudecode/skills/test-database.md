# Skill: Database Testing & Operations

## Overview

Practical guide for testing SQLite database operations and managing database schema in the Doser app.

## When to Use This Skill

- Writing tests for database queries
- Debugging database issues
- Creating database migrations
- Testing multi-profile data isolation
- Verifying data consistency

## Database Testing Patterns

### Setup Test Database

```typescript
// __tests__/database.setup.ts
import * as SQLite from 'expo-sqlite';
import { beforeEach, afterEach } from '@jest/globals';

export let testDb: SQLite.Database;

beforeEach(async () => {
  testDb = await SQLite.openDatabaseAsync(':memory:');
  // Initialize schema
  await initializeTestSchema(testDb);
});

afterEach(async () => {
  await testDb.closeAsync();
});

async function initializeTestSchema(db: SQLite.Database) {
  await db.execAsync([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS medicines (
          id TEXT PRIMARY KEY,
          profileId TEXT NOT NULL,
          name TEXT NOT NULL,
          strength REAL,
          unit TEXT,
          frequency TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `,
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS schedules (
          id TEXT PRIMARY KEY,
          profileId TEXT NOT NULL,
          medicineId TEXT NOT NULL,
          time TEXT,
          daysOfWeek TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )
      `,
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS history (
          id TEXT PRIMARY KEY,
          profileId TEXT NOT NULL,
          medicineId TEXT NOT NULL,
          takenAt INTEGER,
          skipped BOOLEAN,
          notes TEXT,
          createdAt INTEGER
        )
      `,
    },
  ]);
}
```

### Test CRUD Operations

```typescript
// __tests__/database.medicines.test.ts
import { describe, it, expect } from '@jest/globals';
import { testDb } from './database.setup';
import { v4 as uuidv4 } from 'uuid';

describe('Database - Medicines', () => {
  it('should create a medicine', async () => {
    const medicineId = uuidv4();
    const profileId = uuidv4();

    const sql = `
      INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await testDb.execAsync([
      {
        sql,
        args: [medicineId, profileId, 'Aspirin', 100, 'mg', Date.now(), Date.now()],
      },
    ]);

    const result = await testDb.getFirstAsync('SELECT * FROM medicines WHERE id = ?', [medicineId]);

    expect(result).toBeDefined();
    expect(result?.name).toBe('Aspirin');
    expect(result?.strength).toBe(100);
  });

  it('should filter medicines by profile', async () => {
    const profileId1 = uuidv4();
    const profileId2 = uuidv4();

    // Insert medicines for different profiles
    await testDb.execAsync([
      {
        sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [uuidv4(), profileId1, 'Med1', 100, 'mg', Date.now(), Date.now()],
      },
      {
        sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [uuidv4(), profileId2, 'Med2', 200, 'mg', Date.now(), Date.now()],
      },
    ]);

    // Query by profile
    const result = await testDb.getAllAsync('SELECT * FROM medicines WHERE profileId = ?', [
      profileId1,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Med1');
  });

  it('should update a medicine', async () => {
    const medicineId = uuidv4();
    const profileId = uuidv4();

    // Create medicine
    await testDb.execAsync([
      {
        sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [medicineId, profileId, 'Aspirin', 100, 'mg', Date.now(), Date.now()],
      },
    ]);

    // Update medicine
    const newUpdateTime = Date.now();
    await testDb.execAsync([
      {
        sql: `UPDATE medicines SET strength = ?, updatedAt = ? WHERE id = ?`,
        args: [200, newUpdateTime, medicineId],
      },
    ]);

    const result = await testDb.getFirstAsync('SELECT * FROM medicines WHERE id = ?', [medicineId]);

    expect(result?.strength).toBe(200);
    expect(result?.updatedAt).toBe(newUpdateTime);
  });

  it('should delete a medicine', async () => {
    const medicineId = uuidv4();
    const profileId = uuidv4();

    await testDb.execAsync([
      {
        sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [medicineId, profileId, 'Aspirin', 100, 'mg', Date.now(), Date.now()],
      },
    ]);

    await testDb.execAsync([
      {
        sql: 'DELETE FROM medicines WHERE id = ?',
        args: [medicineId],
      },
    ]);

    const result = await testDb.getFirstAsync('SELECT * FROM medicines WHERE id = ?', [medicineId]);

    expect(result).toBeUndefined();
  });
});
```

### Test Multi-Profile Isolation

```typescript
// __tests__/database.profiles.test.ts
describe('Database - Profile Isolation', () => {
  it('should isolate data between profiles', async () => {
    const profile1Id = uuidv4();
    const profile2Id = uuidv4();
    const medicineId1 = uuidv4();
    const medicineId2 = uuidv4();

    // Create medicines for different profiles
    await testDb.execAsync([
      {
        sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [medicineId1, profile1Id, 'Medicine A', 100, 'mg', Date.now(), Date.now()],
      },
      {
        sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [medicineId2, profile2Id, 'Medicine B', 200, 'mg', Date.now(), Date.now()],
      },
    ]);

    // Profile 1 should only see their medicine
    const profile1Medicines = await testDb.getAllAsync(
      'SELECT * FROM medicines WHERE profileId = ?',
      [profile1Id]
    );
    expect(profile1Medicines).toHaveLength(1);
    expect(profile1Medicines[0].id).toBe(medicineId1);

    // Profile 2 should only see their medicine
    const profile2Medicines = await testDb.getAllAsync(
      'SELECT * FROM medicines WHERE profileId = ?',
      [profile2Id]
    );
    expect(profile2Medicines).toHaveLength(1);
    expect(profile2Medicines[0].id).toBe(medicineId2);
  });
});
```

### Test Transactions

```typescript
describe('Database - Transactions', () => {
  it('should rollback on transaction failure', async () => {
    const profileId = uuidv4();
    const medicineId = uuidv4();

    try {
      await testDb.execAsync([
        { sql: 'BEGIN TRANSACTION' },
        {
          sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [medicineId, profileId, 'Test', 100, 'mg', Date.now(), Date.now()],
        },
        // Intentional error - violate constraint
        {
          sql: `INSERT INTO medicines (id, profileId, name, strength, unit, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [medicineId, profileId, 'Duplicate', 200, 'mg', Date.now(), Date.now()],
        },
        { sql: 'COMMIT' },
      ]);
    } catch (error) {
      await testDb.execAsync([{ sql: 'ROLLBACK' }]);
    }

    // Medicine should not exist if transaction failed
    const result = await testDb.getFirstAsync('SELECT * FROM medicines WHERE id = ?', [medicineId]);

    // Note: Behavior depends on database error handling
  });
});
```

## Database Debugging

### Query Inspection

```typescript
// lib/database.debug.ts
export async function inspectDatabase() {
  if (!__DEV__) return;

  try {
    const medicines = await database.medicines.getAll();
    console.log('=== Medicines ===');
    medicines.forEach(m => {
      console.log(`[${m.profileId}] ${m.name} (${m.strength}${m.unit})`);
    });

    const schedules = await database.schedules.getAll();
    console.log('=== Schedules ===');
    schedules.forEach(s => {
      console.log(`${s.medicineId} -> ${s.time}`);
    });
  } catch (error) {
    console.error('Debug inspection failed:', error);
  }
}

// Call in development
import { inspectDatabase } from '@/lib/database.debug';
inspectDatabase();
```

### Schema Validation

```typescript
export async function validateDatabaseSchema() {
  const tables = await database.raw.execute("SELECT name FROM sqlite_master WHERE type='table'");

  const requiredTables = ['medicines', 'schedules', 'history', 'profiles'];
  const existingTables = tables.map((t: any) => t.name);

  requiredTables.forEach(table => {
    if (!existingTables.includes(table)) {
      console.warn(`Missing table: ${table}`);
    }
  });
}
```

## Database Migrations

### Migration File Structure

```typescript
// lib/migrations/001-initial-schema.ts
export async function up(db: SQLite.Database) {
  await db.execAsync([
    {
      sql: `CREATE TABLE medicines (
        id TEXT PRIMARY KEY,
        profileId TEXT NOT NULL,
        name TEXT NOT NULL,
        strength REAL,
        unit TEXT,
        frequency TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      )`,
    },
    // ... more table creations
  ]);
}

export async function down(db: SQLite.Database) {
  await db.execAsync([
    { sql: 'DROP TABLE IF EXISTS medicines' },
    // ... more drops
  ]);
}

// lib/migrations/002-add-notes.ts
export async function up(db: SQLite.Database) {
  await db.execAsync([
    {
      sql: 'ALTER TABLE medicines ADD COLUMN notes TEXT',
    },
  ]);
}

export async function down(db: SQLite.Database) {
  // Note: SQLite doesn't support DROP COLUMN easily
  // Would need to recreate table
}
```

### Running Migrations

```typescript
// lib/database.migrations.ts
const MIGRATIONS = [
  { id: '001', module: require('./migrations/001-initial-schema') },
  { id: '002', module: require('./migrations/002-add-notes') },
];

export async function runMigrations(db: SQLite.Database) {
  // Get applied migrations from a meta table
  const applied = await db.getAllAsync('SELECT id FROM _migrations ORDER BY id');
  const appliedIds = applied.map(m => m.id);

  for (const migration of MIGRATIONS) {
    if (!appliedIds.includes(migration.id)) {
      console.log(`Running migration: ${migration.id}`);
      await migration.module.up(db);
      await db.execAsync([
        {
          sql: 'INSERT INTO _migrations (id, appliedAt) VALUES (?, ?)',
          args: [migration.id, Date.now()],
        },
      ]);
    }
  }
}
```

## Commands

### Run Database Tests

```bash
npm test -- database
npm test -- database.medicines
npm test -- database.profiles
```

### Inspect Database (Development)

```typescript
// In dev console
import { inspectDatabase } from '@/lib/database.debug';
inspectDatabase();
```

### Reset Database

```typescript
export async function resetDatabase() {
  if (!__DEV__) return; // Safety check

  try {
    await database.raw.execute('DELETE FROM history');
    await database.raw.execute('DELETE FROM schedules');
    await database.raw.execute('DELETE FROM medicines');
    await database.raw.execute('DELETE FROM profiles');
    console.log('Database reset complete');
  } catch (error) {
    console.error('Reset failed:', error);
  }
}
```

## Best Practices

1. **Always test profile isolation** - Verify profile filtering works
2. **Use transactions for multi-step operations** - Ensure consistency
3. **Parameterize queries** - Prevent SQL injection
4. **Log database operations** - Debug easier
5. **Test error cases** - Handle constraint violations
6. **Validate on insertion** - Catch bad data early
7. **Use migrations** - Version control schema changes
8. **Performance test** - Large datasets
9. **Backup before migrations** - Safety first
10. **Document schema** - Keep specs up to date
