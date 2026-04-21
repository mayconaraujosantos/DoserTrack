import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInWithOtp } from '@/lib/auth';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';

export default function AuthScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
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
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Ionicons name="medical" size={52} color={C.primary} style={styles.icon} />
        <Text style={styles.title}>Doser</Text>
        <Text style={styles.subtitle}>Sincronize seus dados entre dispositivos.</Text>

        {sent ? (
          <View style={styles.sentCard}>
            <Ionicons name="mail-outline" size={36} color={C.success} />
            <Text style={styles.sentTitle}>Link enviado!</Text>
            <Text style={styles.sentBody}>
              Abra o e-mail em <Text style={{ fontWeight: '700' }}>{email.trim()}</Text> e toque
              no link para entrar.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={C.sub}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Enviar link mágico</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    inner: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 28, gap: 14,
    },
    icon: { marginBottom: 4 },
    title: { fontSize: 32, fontWeight: '800', color: C.text },
    subtitle: { fontSize: 15, color: C.sub, textAlign: 'center', marginBottom: 12 },
    input: {
      width: '100%', height: 52, borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
      backgroundColor: C.card, paddingHorizontal: 16,
      color: C.text, fontSize: 16,
    },
    error: { color: C.danger, fontSize: 13, alignSelf: 'flex-start' },
    btn: {
      width: '100%', height: 52, borderRadius: 14,
      backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    sentCard: {
      alignItems: 'center', gap: 12, padding: 24,
      backgroundColor: C.card, borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    sentTitle: { fontSize: 20, fontWeight: '700', color: C.text },
    sentBody: { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 22 },
  });
}
