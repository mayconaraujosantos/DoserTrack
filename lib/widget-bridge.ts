import { Platform } from 'react-native';
import type { WidgetPayload } from '@/types';

const MAX_DOSES = 5;

function getTodayDate(): string {
  return new Date().toISOString().substring(0, 10); // YYYY-MM-DD
}

async function getNativeModule() {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('@/modules/doser-widget/src');
    return mod;
  } catch {
    return null;
  }
}

export async function updateWidgetData(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const { getActiveProfileId, getProfileById, getDosesForDate } = await import('@/lib/database');
    const native = await getNativeModule();
    if (!native) return;

    const profileId = getActiveProfileId();
    if (!profileId) return;

    const [profile, allDoses] = await Promise.all([
      getProfileById(profileId),
      getDosesForDate(getTodayDate()),
    ]);

    if (!profile) return;

    const visibleDoses = allDoses
      .filter(d => d.status !== 'skipped')
      .slice(0, MAX_DOSES)
      .map(d => ({
        id: d.id,
        medicineName: d.medicineName ?? '',
        dosage: d.dosage ?? '',
        scheduledTime: d.scheduledTime,
        status: d.status,
      }));

    const payload: WidgetPayload = {
      profileId: profile.id,
      profileName: profile.name,
      date: getTodayDate(),
      doses: visibleDoses,
      updatedAt: new Date().toISOString(),
    };

    await native.writeWidgetData(JSON.stringify(payload));
    await native.requestWidgetUpdate();
  } catch {
    // Widget update is non-critical; never propagate errors to the caller
  }
}
