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
import { updatePassword, mapAuthError } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';

export default function ResetPasswordScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && confirm.length > 0 && !loading;

  async function handleReset() {
    if (!canSubmit) return;

    if (password.length < 6) {
      setError('Use ao menos 6 caracteres na senha.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      router.replace('/(tabs)');
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
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: C.primary + '18' }]}>
            <Ionicons name="lock-closed-outline" size={32} color={C.primary} />
          </View>
          <Text style={[styles.title, { color: C.text }]}>Criar nova senha</Text>
          <Text style={[styles.subtitle, { color: C.sub }]}>
            Escolha uma senha forte para proteger sua conta.
          </Text>
        </View>

        {/* Campos */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: C.text }]}>Nova senha</Text>
            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.border }]}>
              <TextInput
                style={[styles.inputInner, { color: C.text }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={C.sub}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={styles.eyeBtn}
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={C.sub}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: C.text }]}>Confirmar senha</Text>
            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.border }]}>
              <TextInput
                style={[styles.inputInner, { color: C.text }]}
                placeholder="Repita a nova senha"
                placeholderTextColor={C.sub}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleReset}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(v => !v)}
                style={styles.eyeBtn}
                accessibilityLabel={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={C.sub}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: C.primary }, !canSubmit && styles.btnDisabled]}
            onPress={handleReset}
            disabled={!canSubmit}
            accessibilityState={{ disabled: !canSubmit }}
            testID="btn-reset"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Criar nova senha</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 32,
  },
  header: { alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  inputWrap: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputInner: { flex: 1, fontSize: 15 },
  eyeBtn: { padding: 4 },
  errorText: { color: '#E74C3C', fontSize: 13 },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
