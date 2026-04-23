import { useEffect, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { initDatabase, resolveProfile, setActiveProfileId } from '@/lib/database';
import {
  setupNotificationHandler,
  requestNotificationPermissions,
  addNotificationResponseListener,
  rescheduleAllPendingDoses,
} from '@/lib/notifications';
import { queryClient } from '@/lib/query-client';
import { useAppStore } from '@/lib/store';
import { getStoredActiveProfileId, hasSeenOnboarding, setStoredActiveProfileId } from '@/lib/storage';
import { onAuthStateChange } from '@/lib/auth';
import { pullFromCloud, syncToCloud } from '@/lib/sync';
import { isBiometricsEnabled, authenticate } from '@/lib/biometrics';
import { ErrorBoundary } from '@/components/error-boundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.bg,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.notification,
  },
};

const DarkAppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.bg,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.notification,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const setDbReady = useAppStore((s) => s.setDbReady);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (next === 'active' && wasBackground) {
        syncToCloud().catch(console.error);
        const enabled = await isBiometricsEnabled();
        if (!enabled) return;
        setLocked(true);
        const ok = await authenticate();
        if (ok) setLocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setupNotificationHandler();
    initDatabase()
      .then(async () => {
        const storedProfileId = await getStoredActiveProfileId();
        const profile = await resolveProfile(storedProfileId);
        setActiveProfile(profile);
        setActiveProfileId(profile.id);
        await setStoredActiveProfileId(profile.id);
        setDbReady(true);
        rescheduleAllPendingDoses().catch(console.error);
      })
      .catch(console.error);
    requestNotificationPermissions().catch(console.error);

    hasSeenOnboarding().then((seen) => {
      if (!seen) router.replace('/onboarding' as never);
    }).catch(console.error);

    const authSub = onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        pullFromCloud().catch(console.error);
      }
    });

    const sub = addNotificationResponseListener((response) => {
      const doseId = response.notification.request.content.data?.doseId as number | undefined;
      if (doseId) {
        router.push({ pathname: '/reminder-alert' as any, params: { doseId } });
      }
    });
    return () => {
      authSub.data.subscription.unsubscribe();
      sub.remove();
    };
  }, [router, setActiveProfile, setDbReady]);

  if (locked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkAppTheme : LightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-medicine"
            options={{ presentation: 'modal', title: 'Novo Medicamento' }}
          />
          <Stack.Screen
            name="edit-medicine"
            options={{ presentation: 'modal', title: 'Editar Medicamento' }}
          />
          <Stack.Screen
            name="add-schedule"
            options={{ presentation: 'modal', title: 'Configurar Horário' }}
          />
          <Stack.Screen
            name="edit-dose"
            options={{ presentation: 'modal', title: 'Editar Dose' }}
          />
          <Stack.Screen
            name="profiles"
            options={{ presentation: 'modal', title: 'Perfis' }}
          />
          <Stack.Screen
            name="reminder-alert"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
