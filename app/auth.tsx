import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInWithOtp } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';

export default function AuthScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Digite um e-mail válido.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithOtp(trimmed);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Ionicons name="medical" size={52} color={C.primary} style={styles.icon} />
        <Text variant="heading" style={styles.title}>
          Doser
        </Text>
        <Text variant="body" color={C.sub} style={styles.subtitle}>
          Sincronize seus dados entre dispositivos.
        </Text>

        {sent ? (
          <Card variant="outlined" style={styles.sentCard}>
            <Ionicons name="mail-outline" size={36} color={C.success} />
            <Text variant="title">Link enviado!</Text>
            <Text variant="body" color={C.sub} style={styles.sentBody}>
              Abra o e-mail em{' '}
              <Text variant="body" style={{ fontWeight: '700' }}>
                {email.trim()}
              </Text>{' '}
              e toque no link para entrar.
            </Text>
          </Card>
        ) : (
          <>
            <Input
              placeholder="seu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              error={error ?? undefined}
              style={styles.inputText}
            />
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              onPress={handleSend}
              style={styles.btn}
              accessibilityLabel="Enviar link mágico"
            >
              Enviar link mágico
            </Button>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  icon: { marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { textAlign: 'center', marginBottom: 12 },
  inputText: { width: '100%' },
  btn: { width: '100%' },
  sentCard: { alignItems: 'center', gap: 12 },
  sentBody: { textAlign: 'center', lineHeight: 22 },
});
