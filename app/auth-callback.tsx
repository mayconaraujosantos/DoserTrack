import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const C = useTheme();

  useEffect(() => {
    if (!supabase) {
      router.replace('/(tabs)' as never);
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        listener.subscription.unsubscribe();
        router.replace('/(tabs)' as never);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
