import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
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
import {
  getStoredActiveProfileId,
  hasSeenOnboarding,
  setStoredActiveProfileId,
} from '@/lib/storage';
import { onAuthStateChange } from '@/lib/auth';
import { pullFromCloud, syncToCloud } from '@/lib/sync';
import { isBiometricsEnabled, authenticate } from '@/lib/biometrics';
import { ErrorBoundary } from '@/components/error-boundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

// System UI (image picker, camera, permission dialogs) causes brief
// inactive/background transitions — only lock if absent longer than this.
const LOCK_THRESHOLD_MS = 5_000;

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
  const setDbReady = useAppStore(s => s.setDbReady);
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [dbError, setDbError] = useState(false);
  const appState = useRef(AppState.currentState);
  const backgroundEnteredAt = useRef<number>(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async next => {
      const prev = appState.current;
      appState.current = next;

      if (prev === 'active' && next.match(/inactive|background/)) {
        backgroundEnteredAt.current = Date.now();
      }

      if (next === 'active' && prev.match(/inactive|background/)) {
        syncToCloud().catch(console.error);
        const enabled = await isBiometricsEnabled();
        if (!enabled) return;
        if (Date.now() - backgroundEnteredAt.current < LOCK_THRESHOLD_MS) return;
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
      .catch(err => {
        console.error('[DB] Falha ao inicializar banco:', err);
        setDbError(true);
      });
    requestNotificationPermissions().catch(console.error);

    hasSeenOnboarding()
      .then(async seen => {
        if (!seen) {
          router.replace('/onboarding');
          return;
        }
        // Já viu onboarding — verifica sessão ativa
        const { getSession } = await import('@/lib/auth');
        const session = await getSession();
        if (!session) router.replace('/login');
      })
      .catch(console.error);

    const authSub = onAuthStateChange(event => {
      if (event === 'SIGNED_IN') {
        pullFromCloud().catch(console.error);
      }
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password' as never);
      }
    });

    const sub = addNotificationResponseListener(response => {
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

  if (dbError) {
    return (
      <View style={errorStyles.container}>
        <Text style={errorStyles.title}>Erro ao abrir o banco de dados</Text>
        <Text style={errorStyles.body}>
          Não foi possível iniciar o armazenamento local. Tente fechar e reabrir o app.
        </Text>
        <TouchableOpacity
          style={errorStyles.btn}
          onPress={() => {
            setDbError(false);
            initDatabase()
              .then(async () => {
                const storedProfileId = await getStoredActiveProfileId();
                const profile = await resolveProfile(storedProfileId);
                setActiveProfile(profile);
                setActiveProfileId(profile.id);
                await setStoredActiveProfileId(profile.id);
                setDbReady(true);
              })
              .catch(err => {
                console.error('[DB] Retry falhou:', err);
                setDbError(true);
              });
          }}
        >
          <Text style={errorStyles.btnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (locked) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}
      >
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
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
            <Stack.Screen
              name="scan-prescription"
              options={{ presentation: 'modal', title: 'Escanear Receita' }}
            />
            <Stack.Screen
              name="scan-medicine"
              options={{ presentation: 'modal', title: 'Escanear Embalagem' }}
            />
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
              options={{ presentation: 'modal', title: 'Novo Horário' }}
            />
            <Stack.Screen
              name="edit-dose"
              options={{ presentation: 'modal', title: 'Editar Dose' }}
            />
            <Stack.Screen name="profiles" options={{ presentation: 'modal', title: 'Perfis' }} />
            <Stack.Screen
              name="reminder-alert"
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
            <Stack.Screen
              name="privacy-policy"
              options={{ presentation: 'modal', title: 'Política de Privacidade' }}
            />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
    gap: 16,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#1a1a1a' },
  body: { fontSize: 14, textAlign: 'center', color: '#666', lineHeight: 20 },
  btn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
