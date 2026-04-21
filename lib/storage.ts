import * as SecureStore from 'expo-secure-store';

const KEYS = {
  onboarding: 'doser_onboarding_done',
  activeProfileId: 'doser_active_profile_id',
} as const;

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEYS.onboarding);
  return val === 'true';
}

export async function markOnboardingDone(): Promise<void> {
  await SecureStore.setItemAsync(KEYS.onboarding, 'true');
}

export async function getStoredActiveProfileId(): Promise<number | null> {
  const val = await SecureStore.getItemAsync(KEYS.activeProfileId);
  if (!val) return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function setStoredActiveProfileId(profileId: number): Promise<void> {
  await SecureStore.setItemAsync(KEYS.activeProfileId, String(profileId));
}
