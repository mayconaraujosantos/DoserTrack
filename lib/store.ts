import { create } from 'zustand';
import { localDateStr } from '@/lib/date';
import type { Profile } from '@/types';

interface AppStore {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dbReady: boolean;
  setDbReady: (ready: boolean) => void;
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile | null) => void;
}

export const useAppStore = create<AppStore>(set => ({
  selectedDate: localDateStr(),
  setSelectedDate: date => set({ selectedDate: date }),
  dbReady: false,
  setDbReady: ready => set({ dbReady: ready }),
  activeProfile: null,
  setActiveProfile: profile => set({ activeProfile: profile }),
}));
