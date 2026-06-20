import { useState, useEffect } from 'react';
import {
  View,
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
import { signOut } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  setBiometricsEnabled,
  authenticate,
} from '@/lib/biometrics';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import type { Profile } from '@/types';

const PROFILE_COLORS = ['#4A90D9', '#27AE60', '#F39C12', '#E74C3C', '#16A085', '#8E44AD'];

// ─── ProfileCard ──────────────────────────────────────────────────────────────

function ProfileCard({
  item,
  active,
  onSelect,
}: Readonly<{
  item: Profile;
  active: boolean;
  onSelect: (profile: Profile) => void;
}>) {
  const C = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onSelect(item)}
      style={[
        styles.profileCard,
        {
          backgroundColor: active ? C.success + '10' : C.card,
          borderColor: active ? C.success : C.border,
        },
      ]}
      accessibilityLabel={`Perfil ${item.name}${active ? ', ativo' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.profileAvatar, { backgroundColor: item.color }]}>
        <Text variant="title" color="#fff" style={styles.profileAvatarText}>
          {item.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.profileInfo}>
        <Text variant="label">{item.name}</Text>
        <Text variant="caption" color={C.sub}>
          {active ? 'Perfil em uso' : 'Toque para ativar'}
          {item.isDefault ? ' • Perfil inicial' : ''}
        </Text>
      </View>
      {active ? <Ionicons name="checkmark-circle" size={22} color={C.success} /> : null}
    </TouchableOpacity>
  );
}

// ─── ProfilesScreen ───────────────────────────────────────────────────────────

export default function ProfilesScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const dbReady = useAppStore(s => s.dbReady);
  const activeProfile = useAppStore(s => s.activeProfile);
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
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
    onSuccess: async profile => {
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
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: C.card, borderBottomColor: C.border },
        ]}
      >
        <Text variant="heading">Perfis</Text>
        <Text variant="caption" color={C.sub} style={styles.headerSub}>
          Separe medicamentos e histórico por pessoa.
        </Text>
      </View>

      {/* New profile form */}
      <Card variant="outlined" style={styles.formCard}>
        <Text variant="label" color={C.sub}>
          Novo perfil
        </Text>
        <View style={styles.formRow}>
          <Input
            placeholder="Ex: Mãe, Pai, João"
            value={name}
            onChangeText={setName}
            style={styles.inputText}
          />
          <IconButton
            name="add"
            variant="primary"
            size={20}
            boxSize={48}
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            accessibilityLabel="Criar perfil"
            style={[styles.addButton, createMutation.isPending && styles.buttonDisabled]}
          />
        </View>
      </Card>

      {/* Biometrics */}
      {bioAvailable && (
        <Card variant="outlined" style={styles.secCard}>
          <View style={styles.secRow}>
            <Ionicons name="finger-print-outline" size={22} color={C.primary} />
            <View style={styles.secInfo}>
              <Text variant="label">Biometria</Text>
              <Text variant="caption" color={C.sub}>
                Exigir digital ou Face ID ao retornar ao app
              </Text>
            </View>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometrics}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
        </Card>
      )}

      <Text variant="label" style={styles.sectionTitle}>
        Perfis cadastrados
      </Text>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text variant="body" color={C.sub} style={styles.emptyText}>
              Nenhum perfil encontrado.
            </Text>
          }
          ListFooterComponent={
            <View>
              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: '#E74C3C' }]}
                onPress={() =>
                  Alert.alert('Sair da conta', 'Deseja realmente sair?', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Sair',
                      style: 'destructive',
                      onPress: () => signOut().catch(() => null),
                    },
                  ])
                }
                accessibilityRole="button"
                accessibilityLabel="Sair da conta"
              >
                <Ionicons name="log-out-outline" size={18} color="#E74C3C" />
                <Text variant="label" color="#E74C3C">
                  Sair da conta
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/privacy-policy' as never)}
                style={styles.privacyLink}
                accessibilityRole="link"
                accessibilityLabel="Ver Política de Privacidade"
              >
                <Ionicons name="shield-checkmark-outline" size={14} color={C.sub} />
                <Text variant="caption" color={C.sub}>
                  Política de Privacidade
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSub: { marginTop: 4 },
  formCard: { margin: 16, gap: 12 },
  formRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  inputText: { flex: 1 },
  addButton: { borderRadius: 12 },
  buttonDisabled: { opacity: 0.6 },
  sectionTitle: { marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  loadingWrap: { paddingTop: 32, alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 24 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
    opacity: 0.6,
  },
  secCard: { marginHorizontal: 16, marginBottom: 8 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secInfo: { flex: 1 },
  // ProfileCard
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontWeight: '800', fontSize: 18 },
  profileInfo: { flex: 1 },
});
