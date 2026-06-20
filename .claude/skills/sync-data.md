# Skill: Data Synchronization & Offline-First

## Overview

Guide for implementing offline-first data synchronization between local SQLite and Supabase.

## When to Use This Skill

- Setting up offline-first sync patterns
- Implementing background synchronization
- Handling merge conflicts
- Testing sync flows
- Debugging sync issues

## Offline-First Architecture

### Sync Service Overview

```typescript
// lib/sync.ts
import { supabase } from './supabase';
import { database } from './database';

export interface SyncResult {
  success: boolean;
  timestamp: number;
  synced: number;
  errors: string[];
}

export interface SyncConflict {
  table: string;
  recordId: string;
  local: any;
  remote: any;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
}

class SyncManager {
  private isSyncing = false;
  private syncQueue: SyncTask[] = [];
  private lastSyncTime = 0;

  async sync(profileId: string): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        timestamp: Date.now(),
        synced: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.isSyncing = true;
    const errors: string[] = [];
    let synced = 0;

    try {
      // 1. Push local changes
      synced += await this.pushChanges(profileId);

      // 2. Pull remote changes
      synced += await this.pullChanges(profileId);

      // 3. Detect and resolve conflicts
      const conflicts = await this.detectConflicts(profileId);
      if (conflicts.length > 0) {
        await this.resolveConflicts(profileId, conflicts);
      }

      this.lastSyncTime = Date.now();
      return { success: true, timestamp: Date.now(), synced, errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown sync error');
      return { success: false, timestamp: Date.now(), synced, errors };
    } finally {
      this.isSyncing = false;
    }
  }

  private async pushChanges(profileId: string): Promise<number> {
    let count = 0;

    try {
      // Get local changes (records with isSynced = false)
      const unsyncedMedicines = await database.medicines.getUnsyncedByProfile(profileId);

      for (const medicine of unsyncedMedicines) {
        try {
          if (medicine.isDeleted) {
            // Delete from remote
            await supabase.from('medicines').delete().eq('id', medicine.id);
          } else if (medicine.remoteId) {
            // Update existing
            await supabase.from('medicines').update(medicine).eq('id', medicine.remoteId);
          } else {
            // Insert new
            await supabase.from('medicines').insert([medicine]);
          }

          // Mark as synced locally
          await database.medicines.markSynced(medicine.id);
          count++;
        } catch (error) {
          console.error(`Failed to sync medicine ${medicine.id}:`, error);
        }
      }

      // Repeat for other tables
      // ... schedules, history, etc.

      return count;
    } catch (error) {
      console.error('Push changes error:', error);
      return 0;
    }
  }

  private async pullChanges(profileId: string): Promise<number> {
    let count = 0;

    try {
      // Get remote changes since last sync
      const remoteChanges = await supabase
        .from('medicines')
        .select('*')
        .eq('profileId', profileId)
        .gt('updatedAt', this.lastSyncTime);

      for (const remote of remoteChanges.data || []) {
        try {
          const local = await database.medicines.getById(remote.id);

          if (!local) {
            // New remote record - insert locally
            await database.medicines.create(remote);
            count++;
          } else if (remote.updatedAt > local.updatedAt) {
            // Remote is newer - update local
            await database.medicines.update(remote.id, remote);
            count++;
          }
          // If local is newer, don't update (local wins by default)
        } catch (error) {
          console.error(`Failed to pull medicine ${remote.id}:`, error);
        }
      }

      // Repeat for other tables
      // ... schedules, history, etc.

      return count;
    } catch (error) {
      console.error('Pull changes error:', error);
      return 0;
    }
  }

  private async detectConflicts(profileId: string): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    try {
      const localMedicines = await database.medicines.getAllByProfile(profileId);

      for (const local of localMedicines) {
        if (!local.remoteId) continue;

        const remote = await supabase
          .from('medicines')
          .select('*')
          .eq('id', local.remoteId)
          .single();

        if (remote.data && remote.data.updatedAt > local.updatedAt && local.hasLocalChanges) {
          conflicts.push({
            table: 'medicines',
            recordId: local.id,
            local,
            remote: remote.data,
            localUpdatedAt: local.updatedAt,
            remoteUpdatedAt: remote.data.updatedAt,
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Conflict detection error:', error);
      return [];
    }
  }

  private async resolveConflicts(profileId: string, conflicts: SyncConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      // Strategy: Last-write-wins based on timestamp
      const winner = conflict.localUpdatedAt > conflict.remoteUpdatedAt ? 'local' : 'remote';

      if (winner === 'remote') {
        // Remote wins - update local
        await database.medicines.update(conflict.recordId, conflict.remote);
      } else {
        // Local wins - push to remote
        await supabase.from('medicines').update(conflict.local).eq('id', conflict.remote.id);
      }

      // Mark as resolved
      await database.medicines.markSynced(conflict.recordId);
    }
  }
}

export const syncManager = new SyncManager();
```

### Background Sync

```typescript
// lib/background-sync.ts
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const SYNC_TASK_NAME = 'DOSER_BACKGROUND_SYNC';

// Register background task
TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const result = await syncManager.sync(profileId);

    return result.success
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.Failed;
  } catch (error) {
    console.error('Background sync error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background sync registered');
  } catch (error) {
    console.error('Failed to register background sync:', error);
  }
}

export function useBackgroundSync(profileId: string) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [profileId]);

  const handleAppStateChange = async (state: string) => {
    if (state === 'active') {
      // App came to foreground - sync immediately
      await syncManager.sync(profileId);
    }
  };
}
```

### Retry Logic

```typescript
// lib/sync-retry.ts
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function syncWithRetry(
  profileId: string,
  config = DEFAULT_RETRY_CONFIG
): Promise<SyncResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await syncManager.sync(profileId);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts - 1) {
        const delay = Math.min(
          config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs
        );

        console.log(`Sync attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Sync failed after all retry attempts');
}
```

## Sync State Management

### Sync Status Store

```typescript
// lib/store.ts - Add to Zustand store
interface SyncState {
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  pendingChanges: number;

  setSyncing: (value: boolean) => void;
  setLastSyncTime: (time: number) => void;
  setSyncError: (error: string | null) => void;
  setPendingChanges: (count: number) => void;
}

export const useSyncStore = create<SyncState>(set => ({
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  pendingChanges: 0,

  setSyncing: value => set({ isSyncing: value }),
  setLastSyncTime: time => set({ lastSyncTime: time }),
  setSyncError: error => set({ syncError: error }),
  setPendingChanges: count => set({ pendingChanges: count }),
}));
```

### Sync Hook

```typescript
// hooks/useSync.ts
import { useCallback, useEffect } from 'react';
import { useSyncStore } from '@/lib/store';
import { syncManager } from '@/lib/sync';

export function useSync(profileId: string) {
  const { isSyncing, lastSyncTime, syncError, setSyncing, setLastSyncTime, setSyncError } =
    useSyncStore();

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);

    try {
      const result = await syncManager.sync(profileId);
      setLastSyncTime(result.timestamp);

      if (!result.success && result.errors.length > 0) {
        setSyncError(result.errors[0]);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [profileId, setSyncing, setLastSyncTime, setSyncError]);

  // Auto-sync on mount
  useEffect(() => {
    sync();
  }, [profileId]);

  return { isSyncing, lastSyncTime, syncError, sync };
}
```

## Testing Sync

### Sync Flow Tests

```typescript
// __tests__/sync.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { syncManager } from '@/lib/sync';
import { database } from '@/lib/database';

describe('Data Synchronization', () => {
  let profileId: string;

  beforeEach(async () => {
    profileId = 'test-profile-123';
    // Clear databases
    await database.medicines.deleteByProfile(profileId);
  });

  it('should push local changes to remote', async () => {
    // Create local medicine without sync
    await database.medicines.create({
      id: 'med-1',
      profileId,
      name: 'Aspirin',
      isSynced: false,
    });

    // Run sync
    const result = await syncManager.sync(profileId);

    expect(result.success).toBe(true);
    expect(result.synced).toBeGreaterThan(0);

    // Verify marked as synced
    const medicine = await database.medicines.getById('med-1');
    expect(medicine?.isSynced).toBe(true);
  });

  it('should pull remote changes to local', async () => {
    // Simulate remote change
    const remoteData = {
      id: 'med-2',
      profileId,
      name: 'Ibuprofen',
      updatedAt: Date.now(),
    };

    // Mock remote fetch
    jest.spyOn(supabase.from('medicines'), 'select').mockResolvedValue({
      data: [remoteData],
    });

    // Run sync
    const result = await syncManager.sync(profileId);

    expect(result.success).toBe(true);

    // Verify pulled locally
    const medicine = await database.medicines.getById('med-2');
    expect(medicine).toBeDefined();
    expect(medicine?.name).toBe('Ibuprofen');
  });

  it('should resolve conflicts with last-write-wins', async () => {
    const now = Date.now();

    // Local version (older)
    await database.medicines.create({
      id: 'med-3',
      profileId,
      name: 'Old Name',
      updatedAt: now - 1000,
      remoteId: 'med-3',
      hasLocalChanges: true,
    });

    // Remote version (newer)
    const remoteData = {
      id: 'med-3',
      name: 'New Name',
      updatedAt: now,
    };

    // Mock remote fetch
    jest.spyOn(supabase.from('medicines'), 'select').mockResolvedValue({
      data: [remoteData],
    });

    // Run sync
    await syncManager.sync(profileId);

    // Remote should win
    const medicine = await database.medicines.getById('med-3');
    expect(medicine?.name).toBe('New Name');
  });
});
```

### Offline/Online Testing

```typescript
// __tests__/offline-sync.test.ts
describe('Offline-First Behavior', () => {
  it('should queue changes when offline', async () => {
    // Simulate offline
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({ isConnected: false });

    // Create medicine
    await database.medicines.create({
      id: 'med-offline',
      name: 'Test',
      isSynced: false,
    });

    // Should be queued
    const queued = await database.medications.getUnsynced();
    expect(queued).toContainEqual(expect.objectContaining({ id: 'med-offline' }));
  });

  it('should sync when back online', async () => {
    // Create medicine while offline
    await database.medicines.create({
      id: 'med-online-test',
      name: 'Test',
      isSynced: false,
    });

    // Go back online
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({ isConnected: true });

    // Trigger sync
    const result = await syncManager.sync(profileId);

    expect(result.success).toBe(true);
    expect(result.synced).toBeGreaterThan(0);
  });
});
```

## UI Sync Status Display

### Sync Status Indicator

```typescript
// components/ui/SyncStatus.tsx
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useSyncStore } from '@/lib/store';

export function SyncStatus() {
  const { isSyncing, lastSyncTime, syncError } = useSyncStore();

  const getStatusMessage = () => {
    if (syncError) return 'Sync failed';
    if (isSyncing) return 'Syncing...';
    if (lastSyncTime) {
      const mins = Math.floor((Date.now() - lastSyncTime) / 60000);
      if (mins < 1) return 'Just synced';
      return `Synced ${mins}m ago`;
    }
    return 'Not synced';
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {isSyncing && <ActivityIndicator />}
      <Text style={{ color: syncError ? 'red' : 'green' }}>
        {getStatusMessage()}
      </Text>
    </View>
  );
}
```

## Best Practices

1. **Always timestamp records** - Use `updatedAt` for conflict resolution
2. **Mark synced locally** - Track which records are synced
3. **Batch operations** - Sync multiple records at once
4. **Implement retries** - Handle transient network failures
5. **Test offline** - Verify queuing and eventual sync
6. **Log sync events** - Debug sync issues
7. **Handle conflicts gracefully** - Last-write-wins or merge strategy
8. **Clear conflicts on deletion** - Don't leave orphaned conflict records
9. **Profile isolation** - Only sync active profile's data
10. **User feedback** - Show sync status in UI

## Debugging Sync Issues

```typescript
// lib/debug.ts
export async function debugSync(profileId: string) {
  if (!__DEV__) return;

  console.log('=== SYNC DEBUG ===');

  const unsynced = await database.medicines.getUnsyncedByProfile(profileId);
  console.log(`Unsynced: ${unsynced.length} medicines`);

  const conflicts = await detectConflicts(profileId);
  console.log(`Conflicts: ${conflicts.length}`);

  const lastSync = useSyncStore.getState().lastSyncTime;
  console.log(`Last sync: ${new Date(lastSync || 0).toISOString()}`);

  console.log('=== END SYNC DEBUG ===');
}
```
