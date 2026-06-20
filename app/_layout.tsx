import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/components/error-boundary';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { queryClient } from '@/lib/query-client';
import { hasSeenOnboarding } from '@/lib/storage';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Impede o splash de esconder automaticamente enquanto o app inicializa
SplashScreen.preventAutoHideAsync();

const log = logger.make('RouteGuard');

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

function InitialRouteGuard() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      log.info('iniciando verificação de rota...');

      const seen = await hasSeenOnboarding();
      log.info('hasSeenOnboarding:', seen);

      if (!seen) {
        log.info('→ redirecionando para /onboarding');
        router.replace('/onboarding');
        await SplashScreen.hideAsync();
        return;
      }

      try {
        log.info('buscando sessão...');
        const done = log.time('getSession');
        const session = await getSession();
        done();
        log.info('sessão:', session ? `ativa (${session.user.email})` : 'nula');

        if (session) {
          log.info('→ permanece no app');
        } else {
          log.info('→ redirecionando para /login');
          router.replace('/login');
        }
      } catch (e) {
        log.error('erro ao buscar sessão:', e);
        router.replace('/login');
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkAppTheme : LightTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <InitialRouteGuard />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
