import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// expo-notifications crashes on import in Expo Go (SDK 53+).
// All usages are guarded: the module is only require()'d at call time.
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function getNotifications() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof import('expo-notifications');
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (IS_EXPO_GO) return false;
  const N = getNotifications();
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('reminders', {
      name: 'Lembretes de Medicamento',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90D9',
    });
  }
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

export function setupNotificationHandler() {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function scheduleDoseNotification(dose: {
  id: number;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
}): Promise<string | null> {
  if (IS_EXPO_GO) return null;
  const N = getNotifications();
  const trigger = new Date(dose.scheduledTime);
  if (trigger <= new Date()) return null;
  try {
    const id = await N.scheduleNotificationAsync({
      content: {
        title: 'Hora do remédio!',
        body: `${dose.medicineName} — ${dose.dosage}`,
        data: { doseId: dose.id },
        sound: true,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleSnoozeNotification(
  dose: {
    id: number;
    medicineName: string;
    dosage: string;
  },
  minutes = 10
): Promise<string | null> {
  if (IS_EXPO_GO) return null;
  const N = getNotifications();
  const trigger = new Date(Date.now() + minutes * 60 * 1000);
  try {
    const id = await N.scheduleNotificationAsync({
      content: {
        title: 'Lembrete adiado',
        body: `${dose.medicineName} — ${dose.dosage}`,
        data: { doseId: dose.id },
        sound: true,
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  await N.cancelScheduledNotificationAsync(notificationId);
}

export async function rescheduleAllPendingDoses(): Promise<void> {
  if (IS_EXPO_GO) return;
  const { getPendingDosesWithoutNotification, updateDoseNotificationId } =
    await import('@/lib/database');
  const doses = await getPendingDosesWithoutNotification();
  for (const dose of doses) {
    const notifId = await scheduleDoseNotification({
      id: dose.id,
      medicineName: dose.medicineName ?? '',
      dosage: dose.dosage ?? '',
      scheduledTime: dose.scheduledTime,
    });
    if (notifId) await updateDoseNotificationId(dose.id, notifId);
  }
}

export async function notifyLowStock(medicine: {
  name: string;
  stockQuantity: number;
  stockUnit: string;
}): Promise<void> {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  await N.scheduleNotificationAsync({
    content: {
      title: 'Estoque baixo',
      body: `${medicine.name} — restam apenas ${medicine.stockQuantity} ${medicine.stockUnit}`,
      data: {},
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyMissedDose(medicine: { name: string; dosage?: string }): Promise<void> {
  if (IS_EXPO_GO) return;
  const N = getNotifications();
  const suffix = medicine.dosage ? ` — ${medicine.dosage}` : '';
  await N.scheduleNotificationAsync({
    content: {
      title: 'Dose não registrada',
      body: `Você tomou ${medicine.name}${suffix}?`,
      data: {},
      sound: true,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30 * 60,
      repeats: false,
    },
  });
}

export function addNotificationResponseListener(
  callback: (response: import('expo-notifications').NotificationResponse) => void
): { remove: () => void } {
  if (IS_EXPO_GO) return { remove: () => undefined };
  const N = getNotifications();
  return N.addNotificationResponseReceivedListener(callback);
}

export async function checkOverdueDoses(): Promise<{ count: number; doses: any[] }> {
  try {
    const { getDosesForDate } = await import('@/lib/database');

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const doses = await getDosesForDate(today);

    const overdue = doses.filter(d => {
      const scheduled = new Date(d.scheduledTime);
      return scheduled < now && d.status !== 'taken' && d.status !== 'skipped';
    });

    return { count: overdue.length, doses: overdue };
  } catch {
    return { count: 0, doses: [] };
  }
}

export async function schedulePeriodicOverdueNotification(intervalMinutes = 60): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    const N = getNotifications();
    const { count } = await checkOverdueDoses();

    if (count === 0) return;

    await N.scheduleNotificationAsync({
      content: {
        title: 'Doses pendentes',
        body: `Você tem ${count} dose${count > 1 ? 's' : ''} que ainda não ${count > 1 ? 'foram' : 'foi'} registrada${count > 1 ? 's' : ''}.`,
        data: { type: 'overdue' },
        sound: true,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: intervalMinutes * 60,
        repeats: true,
      },
    });
  } catch {
    // silently fail
  }
}
