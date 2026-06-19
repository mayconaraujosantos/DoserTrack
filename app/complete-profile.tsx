import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/use-theme';

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Prefiro não dizer'];

export default function CompleteProfileScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [genderOpen, setGenderOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function handleComplete() {
    setLoading(true);
    // Perfil opcional — navega direto para /(tabs)
    router.replace('/(tabs)');
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: C.bg }]}
      contentContainerStyle={[styles.inner, { paddingTop: insets.top + 16 }]}
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
        <Text style={[styles.title, { color: C.text }]}>Completar Perfil</Text>
        <Text style={[styles.subtitle, { color: C.sub }]}>
          Adicione informações opcionais ao seu perfil.
        </Text>
      </View>

      {/* Avatar */}
      <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View
            style={[styles.avatarPlaceholder, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Ionicons name="person-outline" size={40} color={C.sub} />
          </View>
        )}
        <View style={[styles.avatarBadge, { backgroundColor: C.primary }]}>
          <Ionicons name="pencil" size={12} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Campos */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: C.text }]}>Nome</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: C.card, borderColor: C.border, color: C.text },
            ]}
            placeholder="Nome completo"
            placeholderTextColor={C.sub}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: C.text }]}>Telefone</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: C.card, borderColor: C.border, color: C.text },
            ]}
            placeholder="+55 (00) 00000-0000"
            placeholderTextColor={C.sub}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: C.text }]}>Gênero</Text>
          <TouchableOpacity
            style={[styles.select, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => setGenderOpen(v => !v)}
          >
            <Text style={[styles.selectText, { color: gender ? C.text : C.sub }]}>
              {gender || 'Selecione'}
            </Text>
            <Ionicons name={genderOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.sub} />
          </TouchableOpacity>
          {genderOpen && (
            <View style={[styles.dropdown, { backgroundColor: C.card, borderColor: C.border }]}>
              {GENDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: C.border },
                    gender === opt && { backgroundColor: C.primary + '12' },
                  ]}
                  onPress={() => {
                    setGender(opt);
                    setGenderOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownText, { color: C.text }]}>{opt}</Text>
                  {gender === opt && <Ionicons name="checkmark" size={16} color={C.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Botões */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: C.primary }]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Completar Perfil</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.skipText, { color: C.sub }]}>Pular por agora</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 24,
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
  avatarWrap: { alignSelf: 'center', position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  select: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 15 },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownText: { fontSize: 15 },
  actions: { gap: 16 },
  btnPrimary: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipText: { textAlign: 'center', fontSize: 14 },
});
