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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signUp, mapAuthError } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function RegisterScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length >= 2 && email.trim().length > 0 && password.length > 0 && agreed && !loading;

  async function handleRegister() {
    if (!canSubmit) return;

    // Validações de formato antes de chamar API
    if (!isValidEmail(email)) {
      setError('Digite um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setError('Use ao menos 6 caracteres na senha.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, name.trim());
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
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={[styles.title, { color: C.text }]}>Criar Conta</Text>
          <Text style={[styles.subtitle, { color: C.sub }]}>
            Cadastre-se para sincronizar seus medicamentos.
          </Text>
        </View>

        {/* Campos */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: C.text }]}>Nome completo</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: C.card, borderColor: C.border, color: C.text },
              ]}
              placeholder="Seu nome"
              placeholderTextColor={C.sub}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

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
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: C.text }]}>Senha</Text>
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

          {/* Checkbox termos */}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setAgreed(v => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: agreed ? C.primary : C.border },
                agreed && { backgroundColor: C.primary },
              ]}
            >
              {agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={[styles.checkLabel, { color: C.sub }]}>
              Concordo com os{' '}
              <Text style={[styles.checkLink, { color: C.primary }]}>Termos e Condições</Text>
            </Text>
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: C.primary }, !canSubmit && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
            accessibilityState={{ disabled: !canSubmit }}
            testID="btn-register"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Registrar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divisor */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: C.border }]} />
          <Text style={[styles.dividerText, { color: C.sub }]}>ou</Text>
          <View style={[styles.dividerLine, { backgroundColor: C.border }]} />
        </View>

        {/* Rodapé */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.sub }]}>Já tenho conta? </Text>
          <TouchableOpacity onPress={() => router.push('/login')} testID="link-login">
            <Text style={[styles.footerLink, { color: C.primary }]}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: 'center',
    gap: 24,
  },
  backBtn: { marginBottom: -8 },
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { flex: 1, fontSize: 13, lineHeight: 18 },
  checkLink: { fontWeight: '600' },
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
});
