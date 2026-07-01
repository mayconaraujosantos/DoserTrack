import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { hasSeenOnboarding } from '@/lib/storage';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

const log = logger.make('RouteGuard');

export default function Index() {
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
          log.info('→ redirecionando para o app');
          router.replace('/(app)/(tabs)');
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
