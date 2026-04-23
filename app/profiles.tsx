import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  FlatList,
  Alert,
  ActivityIndicator,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { createProfile, getProfiles, setActiveProfileId } from '@/lib/database';
import { setStoredActiveProfileId } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import { isBiometricsAvailable, isBiometricsEnabled, setBiometricsEnabled, authenticate } from '@/lib/biometrics';
import type { Profile } from '@/types';

const PROFILE_COLORS = ['#4A90D9', '#27AE60', '#F39C12', '#E74C3C', '#16A085', '#8E44AD'];

function ProfileCard({ item, active, onSelect }: Readonly<{
  item: Profile;
  active: boolean;
  onSelect: (profile: Profile) => void;
}>) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(item)}
      style={[styles.profileCard, active && styles.profileCardActive]}>
      <View style={[styles.profileAvatar, { backgroundColor: item.color }]}> 
        <Text style={styles.profileAvatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>{item.name}</Text>
        <Text style={styles.profileMeta}>
          {active ? 'Perfil em uso' : 'Toque para ativar'}
          {item.isDefault ? ' • Perfil inicial' : ''}
        </Text>
      </View>
      {active ? <Ionicons name="checkmark-circle" size={22} color={C.success} /> : null}
    </TouchableOpacity>
  );
}

export default function ProfilesScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const dbReady = useAppStore((s) => s.dbReady);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const [name, setName] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    isBiometricsAvailable().then(setBioAvailable);
    isBiometricsEnabled().then(setBioEnabled);
  }, []);

  async function toggleBiometrics(value: boolean) {
    if (value) {
      const ok = await authenticate();
      if (!ok) return;
    }
    await setBiometricsEnabled(value);
    setBioEnabled(value);
  }

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: dbReady,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Digite um nome para o perfil.');
      const color = PROFILE_COLORS[profiles.length % PROFILE_COLORS.length];
      return createProfile({ name: trimmed, color });
    },
    onSuccess: async (profile) => {
      setName('');
      await qc.invalidateQueries({ queryKey: ['profiles'] });
      await handleSelectProfile(profile);
    },
    onError: (error: Error) => Alert.alert('Erro', error.message),
  });

  async function handleSelectProfile(profile: Profile) {
    setActiveProfile(profile);
    setActiveProfileId(profile.id);
    await setStoredActiveProfileId(profile.id);
    await qc.invalidateQueries();
    router.back();
  }

  const renderItem = ({ item }: ListRenderItemInfo<Profile>) => (
    <ProfileCard
      item={item}
      active={item.id === activeProfile?.id}
      onSelect={handleSelectProfile}
    />
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}> 
        <Text style={styles.title}>Perfis</Text>
        <Text style={styles.subtitle}>Separe medicamentos e historico por pessoa.</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Novo perfil</Text>
        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="Ex: Mae, Pai, Joao"
            placeholderTextColor={C.sub}
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity
            style={[styles.addButton, createMutation.isPending && styles.buttonDisabled]}
            disabled={createMutation.isPending}
            onPress={() => createMutation.mutate()}>
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="add" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {bioAvailable && (
        <View style={styles.secCard}>
          <View style={styles.secRow}>
            <Ionicons name="finger-print-outline" size={22} color={C.primary} />
            <View style={styles.secInfo}>
              <Text style={styles.secTitle}>Biometria</Text>
              <Text style={styles.secSub}>Exigir digital ou Face ID ao retornar ao app</Text>
            </View>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometrics}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Perfis cadastrados</Text>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum perfil encontrado.</Text>}
        />
      )}
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: C.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    title: { fontSize: 26, fontWeight: '700', color: C.text },
    subtitle: { fontSize: 13, color: C.sub, marginTop: 4 },
    formCard: {
      margin: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      gap: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
      marginHorizontal: 16,
      marginBottom: 8,
    },
    formRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    input: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: C.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 14,
      color: C.text,
      fontSize: 15,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primary,
    },
    buttonDisabled: { opacity: 0.6 },
    listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
    loadingWrap: { paddingTop: 32 },
    emptyText: { textAlign: 'center', color: C.sub, marginTop: 24 },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    profileCardActive: {
      borderColor: C.success,
      backgroundColor: C.success + '10',
    },
    profileAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 16, fontWeight: '700', color: C.text },
    profileMeta: { fontSize: 12, color: C.sub, marginTop: 3 },
    secCard: {
      marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16,
      backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    secRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    secInfo: { flex: 1 },
    secTitle: { fontSize: 15, fontWeight: '700', color: C.text },
    secSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  });
}
