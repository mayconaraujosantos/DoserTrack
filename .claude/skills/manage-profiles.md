# Skill: Profile & Medicine Management

## Overview

Guide for managing multiple user profiles, medicines, and doses in Doser.

## When to Use This Skill

- Creating and switching user profiles
- Managing medicine records
- Creating schedules
- Recording dose history
- Testing profile isolation

## Profile Management

### Profile Service

```typescript
// lib/profiles.ts
import { database } from './database';
import { supabase } from './supabase';
import { useAppStore } from './store';

export interface Profile {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  conditions?: string[];
  medications?: string;
  allergies?: string;
  createdAt: number;
  updatedAt: number;
  userId?: string; // For multi-device sync
}

class ProfileManager {
  async createProfile(data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Promise<Profile> {
    try {
      const profile: Profile = {
        id: generateId(),
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save locally
      await database.profiles.create(profile);

      // Sync to cloud
      const user = await getCurrentUser();
      if (user) {
        profile.userId = user.id;
        await supabase.from('profiles').insert([profile]);
      }

      return profile;
    } catch (error) {
      console.error('Failed to create profile:', error);
      throw error;
    }
  }

  async getProfiles(): Promise<Profile[]> {
    try {
      return await database.profiles.getAll();
    } catch (error) {
      console.error('Failed to get profiles:', error);
      return [];
    }
  }

  async getProfile(profileId: string): Promise<Profile | null> {
    try {
      return await database.profiles.getById(profileId);
    } catch (error) {
      console.error('Failed to get profile:', error);
      return null;
    }
  }

  async updateProfile(profileId: string, data: Partial<Profile>): Promise<Profile | null> {
    try {
      const updated: Profile = {
        ...(await database.profiles.getById(profileId))!,
        ...data,
        updatedAt: Date.now(),
      };

      // Save locally
      await database.profiles.update(profileId, updated);

      // Sync to cloud
      const user = await getCurrentUser();
      if (user) {
        updated.userId = user.id;
        await supabase.from('profiles').update(updated).eq('id', profileId);
      }

      return updated;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    try {
      // Delete all related data
      await database.medicines.deleteByProfile(profileId);
      await database.schedules.deleteByProfile(profileId);
      await database.history.deleteByProfile(profileId);

      // Delete profile
      await database.profiles.delete(profileId);

      // Delete from cloud
      const user = await getCurrentUser();
      if (user) {
        await supabase.from('profiles').delete().eq('id', profileId);
      }

      // Clear from app state if active
      if (useAppStore.getState().activeProfileId === profileId) {
        useAppStore.setState({ activeProfileId: null });
      }

      return true;
    } catch (error) {
      console.error('Failed to delete profile:', error);
      throw error;
    }
  }

  async setActiveProfile(profileId: string): Promise<void> {
    try {
      const profile = await this.getProfile(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      useAppStore.setState({ activeProfileId: profileId });

      // Notify listeners
      queryClient.invalidateQueries({ queryKey: ['medicines', profileId] });
      queryClient.invalidateQueries({ queryKey: ['schedules', profileId] });
    } catch (error) {
      console.error('Failed to set active profile:', error);
      throw error;
    }
  }
}

export const profileManager = new ProfileManager();
```

### Profile Hook

```typescript
// hooks/useProfiles.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileManager } from '@/lib/profiles';
import { useAppStore } from '@/lib/store';

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: () => profileManager.getProfiles(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveProfile() {
  const activeProfileId = useAppStore(state => state.activeProfileId);

  return useQuery({
    queryKey: ['profile', activeProfileId],
    queryFn: () => (activeProfileId ? profileManager.getProfile(activeProfileId) : null),
    enabled: !!activeProfileId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof profileManager.createProfile>[0]) =>
      profileManager.createProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      profileId: string;
      data: Parameters<typeof profileManager.updateProfile>[1];
    }) => profileManager.updateProfile(params.profileId, params.data),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', data?.id] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => profileManager.deleteProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useSetActiveProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => profileManager.setActiveProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
```

## Medicine Management

### Medicine Service

```typescript
// lib/medicines.ts
export interface Medicine {
  id: string;
  profileId: string;
  name: string;
  strength: number;
  unit: string; // mg, ml, tablet, etc
  form: string; // tablet, capsule, liquid, injection, etc
  frequency: string; // daily, weekly, as-needed, etc
  dosage: number; // how much per dose
  notes?: string;
  prescribedBy?: string;
  prescriptionDate?: number;
  expirationDate?: number;
  createdAt: number;
  updatedAt: number;
}

class MedicineManager {
  async createMedicine(
    profileId: string,
    data: Omit<Medicine, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>
  ): Promise<Medicine> {
    try {
      // Validate input
      if (!data.name?.trim()) throw new Error('Medicine name is required');
      if (data.strength <= 0) throw new Error('Strength must be positive');

      const medicine: Medicine = {
        id: generateId(),
        profileId,
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save locally
      await database.medicines.create(medicine);

      // Queue for sync
      await syncManager.addToQueue(medicine);

      return medicine;
    } catch (error) {
      console.error('Failed to create medicine:', error);
      throw error;
    }
  }

  async getMedicinesByProfile(profileId: string): Promise<Medicine[]> {
    try {
      return await database.medicines.getByProfile(profileId);
    } catch (error) {
      console.error('Failed to get medicines:', error);
      throw error;
    }
  }

  async getMedicine(id: string): Promise<Medicine | null> {
    try {
      return await database.medicines.getById(id);
    } catch (error) {
      console.error('Failed to get medicine:', error);
      return null;
    }
  }

  async updateMedicine(id: string, data: Partial<Medicine>): Promise<Medicine | null> {
    try {
      const medicine = await database.medicines.getById(id);
      if (!medicine) throw new Error('Medicine not found');

      const updated: Medicine = {
        ...medicine,
        ...data,
        updatedAt: Date.now(),
      };

      await database.medicines.update(id, updated);
      await syncManager.addToQueue(updated);

      return updated;
    } catch (error) {
      console.error('Failed to update medicine:', error);
      throw error;
    }
  }

  async deleteMedicine(id: string): Promise<boolean> {
    try {
      const medicine = await database.medicines.getById(id);
      if (!medicine) throw new Error('Medicine not found');

      // Delete related schedules
      const schedules = await database.schedules.getByMedicine(id);
      for (const schedule of schedules) {
        await database.schedules.delete(schedule.id);
      }

      // Mark as deleted locally (soft delete)
      await database.medicines.delete(id);

      // Queue for sync
      await syncManager.addToQueue({ ...medicine, isDeleted: true });

      return true;
    } catch (error) {
      console.error('Failed to delete medicine:', error);
      throw error;
    }
  }

  async searchMedicines(profileId: string, query: string): Promise<Medicine[]> {
    try {
      const medicines = await this.getMedicinesByProfile(profileId);
      const normalizedQuery = query.toLowerCase();

      return medicines.filter(
        m =>
          m.name.toLowerCase().includes(normalizedQuery) ||
          m.form?.toLowerCase().includes(normalizedQuery)
      );
    } catch (error) {
      console.error('Failed to search medicines:', error);
      return [];
    }
  }
}

export const medicineManager = new MedicineManager();
```

### Medicine Hook

```typescript
// hooks/useMedicines.ts
export function useMedicines(profileId: string | null) {
  return useQuery({
    queryKey: ['medicines', profileId],
    queryFn: () =>
      profileId ? medicineManager.getMedicinesByProfile(profileId) : Promise.resolve([]),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMedicine() {
  const queryClient = useQueryClient();
  const profileId = useAppStore(state => state.activeProfileId);

  return useMutation({
    mutationFn: (data: Parameters<typeof medicineManager.createMedicine>[1]) =>
      medicineManager.createMedicine(profileId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines', profileId] });
    },
  });
}

export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  const profileId = useAppStore(state => state.activeProfileId);

  return useMutation({
    mutationFn: (params: {
      id: string;
      data: Parameters<typeof medicineManager.updateMedicine>[1];
    }) => medicineManager.updateMedicine(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines', profileId] });
    },
  });
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient();
  const profileId = useAppStore(state => state.activeProfileId);

  return useMutation({
    mutationFn: (id: string) => medicineManager.deleteMedicine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines', profileId] });
    },
  });
}
```

## Schedule Management

### Schedule Service

```typescript
// lib/schedules.ts
export interface Schedule {
  id: string;
  profileId: string;
  medicineId: string;
  time: string; // HH:mm format
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  dosage: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

class ScheduleManager {
  async createSchedule(
    profileId: string,
    data: Omit<Schedule, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>
  ): Promise<Schedule> {
    try {
      const schedule: Schedule = {
        id: generateId(),
        profileId,
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await database.schedules.create(schedule);
      await this.scheduleNotifications(schedule);

      return schedule;
    } catch (error) {
      console.error('Failed to create schedule:', error);
      throw error;
    }
  }

  async getSchedulesByProfile(profileId: string): Promise<Schedule[]> {
    return database.schedules.getByProfile(profileId);
  }

  async getSchedulesForToday(profileId: string): Promise<Schedule[]> {
    const schedules = await this.getSchedulesByProfile(profileId);
    const today = new Date().getDay();
    return schedules.filter(s => s.daysOfWeek.includes(today));
  }

  private async scheduleNotifications(schedule: Schedule): Promise<void> {
    try {
      const medicine = await medicineManager.getMedicine(schedule.medicineId);
      if (!medicine) return;

      // Schedule daily notification
      await notificationManager.scheduleRecurring({
        title: `Time to take ${medicine.name}`,
        body: `Take ${schedule.dosage}${medicine.unit}`,
        time: schedule.time,
        daysOfWeek: schedule.daysOfWeek,
        data: { scheduleId: schedule.id },
      });
    } catch (error) {
      console.error('Failed to schedule notifications:', error);
    }
  }
}

export const scheduleManager = new ScheduleManager();
```

## Dose History

### History Service

```typescript
// lib/history.ts
export interface DoseHistory {
  id: string;
  profileId: string;
  medicineId: string;
  scheduledTime: number;
  takenAt?: number;
  skipped: boolean;
  notes?: string;
  createdAt: number;
}

class HistoryManager {
  async recordDose(
    profileId: string,
    medicineId: string,
    taken: boolean,
    notes?: string
  ): Promise<DoseHistory> {
    try {
      const record: DoseHistory = {
        id: generateId(),
        profileId,
        medicineId,
        scheduledTime: Date.now(),
        takenAt: taken ? Date.now() : undefined,
        skipped: !taken,
        notes,
        createdAt: Date.now(),
      };

      await database.history.create(record);
      await syncManager.addToQueue(record);

      return record;
    } catch (error) {
      console.error('Failed to record dose:', error);
      throw error;
    }
  }

  async getHistoryByPeriod(
    profileId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DoseHistory[]> {
    return database.history.getByProfileAndPeriod(
      profileId,
      startDate.getTime(),
      endDate.getTime()
    );
  }

  async getAdherence(profileId: string, days: number = 30): Promise<number> {
    const now = Date.now();
    const startDate = new Date(now - days * 24 * 60 * 60 * 1000);

    const history = await this.getHistoryByPeriod(profileId, startDate, new Date());
    if (history.length === 0) return 0;

    const taken = history.filter(h => !h.skipped).length;
    return Math.round((taken / history.length) * 100);
  }
}

export const historyManager = new HistoryManager();
```

## Testing

```typescript
// __tests__/profiles.test.ts
describe('Profile Management', () => {
  it('should create a profile', async () => {
    const profile = await profileManager.createProfile({
      name: 'John',
      age: 30,
    });

    expect(profile).toBeDefined();
    expect(profile.name).toBe('John');
  });

  it('should isolate medicines by profile', async () => {
    const profile1 = await profileManager.createProfile({ name: 'Profile 1' });
    const profile2 = await profileManager.createProfile({ name: 'Profile 2' });

    await medicineManager.createMedicine(profile1.id, { name: 'Med1' });
    await medicineManager.createMedicine(profile2.id, { name: 'Med2' });

    const med1 = await medicineManager.getMedicinesByProfile(profile1.id);
    expect(med1).toHaveLength(1);
    expect(med1[0].name).toBe('Med1');
  });
});
```

## Best Practices

1. **Validate input** - Check medicine names, values, etc.
2. **Check profile exists** - Before creating related entities
3. **Cascade deletes** - Delete related data when profile deleted
4. **Isolate data** - Always filter by profileId
5. **Schedule notifications** - Create reminders for doses
6. **Track adherence** - Monitor dose compliance
7. **Soft delete** - Mark as deleted for sync
8. **Test isolation** - Verify profile separation
9. **Handle timezone** - Consider user timezone for schedules
10. **Archive old data** - Clean up very old history
