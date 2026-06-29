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
import { Colors } from '@/constants/theme';
import { initDatabase, resolveProfile, setActiveProfileId } from '@/lib/database';
import {
  setupNotificationHandler,
  requestNotificationPermissions,
  addNotificationResponseListener,
  rescheduleAllPendingDoses,
} from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import { getStoredActiveProfileId, setStoredActiveProfileId } from '@/lib/storage';
import { onAuthStateChange } from '@/lib/auth';
import { pullFromCloud, syncToCloud } from '@/lib/sync';
import { isBiometricsEnabled, authenticate } from '@/lib/biometrics';
import { logger } from '@/lib/logger';

const log = logger.make('AppLayout');

// System UI (image picker, camera, permission dialogs) causes brief
// inactive/background transitions — only lock if absent longer than this.
const LOCK_THRESHOLD_MS = 5_000;

export default function AppLayout() {
  const setDbReady = useAppStore(s => s.setDbReady);
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
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
        log.info('app voltou ao foreground — iniciando syncToCloud');
        syncToCloud().catch(e => log.error('syncToCloud falhou:', e));
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
    log.info('montando — iniciando DB e listeners');
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

    const authSub = onAuthStateChange((event, session) => {
      log.info('auth event:', event, '| user:', session?.user.email ?? 'nenhum');
      if (event === 'SIGNED_IN') {
        log.info('SIGNED_IN — iniciando pullFromCloud');
        pullFromCloud().catch(e => log.error('pullFromCloud falhou:', e));
      }
      if (event === 'SIGNED_OUT') {
        log.info('SIGNED_OUT — redirecionando para /login');
        router.replace('/login');
      }
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });

    const notifSub = addNotificationResponseListener(response => {
      const doseId = response.notification.request.content.data?.doseId as number | undefined;
      if (doseId) {
        router.push({ pathname: '/reminder-alert' as any, params: { doseId } });
      }
    });

    setInitializing(false);

    return () => {
      log.info('desmontando — removendo listeners');
      authSub.data.subscription.unsubscribe();
      notifSub.remove();
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

  if (initializing) {
    return <View style={{ flex: 1 }} />;
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
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      <Stack.Screen
        name="scan-prescription"
        options={{ presentation: 'modal', title: 'Escanear Receita' }}
      />
      <Stack.Screen
        name="scan-medicine"
        options={{ presentation: 'modal', title: 'Escanear Embalagem' }}
      />
      <Stack.Screen name="add-medicine" options={{ headerShown: false }} />
      <Stack.Screen
        name="edit-medicine"
        options={{ presentation: 'modal', title: 'Editar Medicamento' }}
      />
      <Stack.Screen
        name="add-schedule"
        options={{ presentation: 'modal', title: 'Novo Horário' }}
      />
      <Stack.Screen name="edit-dose" options={{ presentation: 'modal', title: 'Editar Dose' }} />
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
