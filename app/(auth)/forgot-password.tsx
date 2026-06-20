import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordReset, mapAuthError } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function ForgotPasswordScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isValidEmail(email) && !loading;

  async function handleSend() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      setError(mapAuthError(e));
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
        {/* Botão voltar */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
        >
          <View style={[styles.backCircle, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
          </View>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: C.text }]}>Esqueci a Senha</Text>
          <Text style={[styles.subtitle, { color: C.sub }]}>
            Digite seu e-mail e enviaremos instruções para redefinir sua senha.
          </Text>
        </View>

        {sent ? (
          /* Estado de sucesso */
          <View style={[styles.successCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.successIcon, { backgroundColor: C.primary + '18' }]}>
              <Ionicons name="mail-outline" size={32} color={C.primary} />
            </View>
            <Text style={[styles.successTitle, { color: C.text }]}>Verifique seu e-mail</Text>
            <Text style={[styles.successBody, { color: C.sub }]}>
              Enviamos instruções para{' '}
              <Text style={{ fontWeight: '700', color: C.text }}>{email.trim()}</Text>.{'\n'}
              Verifique também a pasta de spam.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.btnText}>Voltar para Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Formulário */
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: C.text }]}>E-mail</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: C.card, borderColor: C.border, color: C.text },
                ]}
                placeholder="seu@email.com"
                placeholderTextColor={C.sub}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleSend}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.primary }, !canSubmit && styles.btnDisabled]}
              onPress={handleSend}
              disabled={!canSubmit}
              accessibilityState={{ disabled: !canSubmit }}
              testID="btn-send"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Enviar instruções</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 28,
  },
  backBtn: {},
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  errorText: { color: '#E74C3C', fontSize: 13 },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successBody: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
