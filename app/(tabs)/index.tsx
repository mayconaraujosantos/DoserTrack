import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, RefreshControl,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDosesForDate, updateDoseStatus } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { notifyMissedDose } from '@/lib/notifications';
import { syncToCloud } from '@/lib/sync';
import { DoseCardSkeleton } from '@/components/ui/skeleton';
import { AdherenceWidget } from '@/components/ui/adherence-widget';
import type { Dose } from '@/types';

type FilterTab = 'upcoming' | 'taken' | 'late';
type DoseState = 'late' | 'taken' | 'upcoming' | 'snoozed';

function getDoseState(dose: Dose): DoseState {
  if (dose.status === 'taken') return 'taken';
  if (dose.status === 'skipped') return 'late';
  if (dose.status === 'snoozed') return 'snoozed';
  return new Date(dose.scheduledTime) < new Date() ? 'late' : 'upcoming';
}

function stateColor(state: DoseState, C: ThemeColors): string {
  if (state === 'taken') return C.success;
  if (state === 'late') return C.danger;
  return C.primary;
}

function stateLabel(state: DoseState): string {
  if (state === 'taken') return 'Tomado';
  if (state === 'late') return 'Atrasado';
  if (state === 'snoozed') return 'Soneca';
  return 'Pendente';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function DoseCard({ dose, onCheck, onSkip, onEdit }: Readonly<{
  dose: Dose;
  onCheck: (id: number) => void;
  onSkip: (id: number) => void;
  onEdit: (id: number) => void;
}>) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const state = getDoseState(dose);
  const color = stateColor(state, C);
  const label = stateLabel(state);

  const time = formatTime(dose.scheduledTime);
  return (
    <View
      style={[styles.card, state === 'taken' && styles.cardDone]}
      accessible
      accessibilityLabel={`${dose.medicineName}, ${dose.dosage ?? ''}, ${time}, ${label}`}
    >
      <View style={[styles.timeBar, { backgroundColor: color }]} />
      {dose.medicinePhotoUri ? (
        <Image source={{ uri: dose.medicinePhotoUri }} style={styles.photo} accessibilityIgnoresInvertColors />
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.time}>{time}</Text>
          <View style={[styles.badge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.badgeText, { color }]}>{label}</Text>
          </View>
        </View>
        <Text style={styles.medicineName}>{dose.medicineName}</Text>
        {dose.dosage ? <Text style={styles.dosage}>{dose.dosage}</Text> : null}
      </View>
      {state !== 'taken' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={() => onCheck(dose.id)}
            accessibilityLabel={`Marcar ${dose.medicineName} como tomado`}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => onSkip(dose.id)}
            accessibilityLabel={`Pular dose de ${dose.medicineName}`}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={18} color={C.sub} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => onEdit(dose.id)}
            accessibilityLabel="Editar dose"
            accessibilityRole="button"
          >
            <Ionicons name="pencil-outline" size={15} color={C.sub} />
          </TouchableOpacity>
        </View>
      )}
      {state === 'taken' && (
        <View style={styles.actions}>
          <Ionicons name="checkmark-circle" size={26} color={C.success} accessibilityLabel="Tomado" />
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => onEdit(dose.id)}
            accessibilityLabel="Editar dose"
            accessibilityRole="button"
          >
            <Ionicons name="pencil-outline" size={15} color={C.sub} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const dbReady = useAppStore((s) => s.dbReady);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: doses = [], isLoading, refetch } = useQuery({
    queryKey: ['doses', selectedDate],
    queryFn: () => getDosesForDate(selectedDate),
    enabled: dbReady,
  });

  const takeMutation = useMutation({
    mutationFn: (id: number) =>
      updateDoseStatus(id, 'taken', new Date().toISOString()),
    onSuccess: () => {
      haptic.success();
      syncToCloud().catch(console.error);
      qc.invalidateQueries({ queryKey: ['doses'] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: (id: number) => updateDoseStatus(id, 'skipped'),
    onSuccess: (_, id) => {
      haptic.warning();
      syncToCloud().catch(console.error);
      const dose = doses.find((d) => d.id === id);
      if (dose) notifyMissedDose({ name: dose.medicineName ?? '', dosage: dose.dosage }).catch(console.error);
      qc.invalidateQueries({ queryKey: ['doses'] });
    },
  });

  const filtered = doses.filter((d) => {
    const state = getDoseState(d);
    if (filter === 'taken') return d.status === 'taken';
    if (filter === 'late') return state === 'late';
    return state === 'upcoming' || state === 'snoozed';
  });

  const counts = {
    upcoming: doses.filter((d) => { const s = getDoseState(d); return s === 'upcoming' || s === 'snoozed'; }).length,
    taken: doses.filter((d) => d.status === 'taken').length,
    late: doses.filter((d) => getDoseState(d) === 'late').length,
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Dose>) => (
      <DoseCard
        dose={item}
        onCheck={(id) => takeMutation.mutate(id)}
        onSkip={(id) => skipMutation.mutate(id)}
        onEdit={(id) => router.push(`/edit-dose?id=${id}` as never)}
      />
    ),
    [takeMutation, skipMutation, router]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Hoje</Text>
          <Text style={styles.headerDate}>{dateLabel}</Text>
          {activeProfile ? (
            <TouchableOpacity onPress={() => router.push('/profiles' as never)} style={styles.profileChip}>
              <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.profileChipText}>{activeProfile.name}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {doses.length > 0 && (
            <View style={styles.progressBox}>
              <Text style={styles.progressLabel}>
                {counts.taken}/{doses.length}
              </Text>
              <Text style={styles.progressSub}>doses</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round((counts.taken / doses.length) * 100)}%` as unknown as number }]} />
              </View>
            </View>
          )}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/scan-prescription' as never)}>
              <Ionicons name="scan-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-medicine' as never)}>
              <Ionicons name="add" size={24} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['upcoming', 'taken', 'late'] as FilterTab[]).map((tab) => {
          const labels: Record<FilterTab, string> = { upcoming: 'Próximos', taken: 'Tomados', late: 'Atrasados' };
          const active = filter === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {labels[tab]} {counts[tab] > 0 ? `(${counts[tab]})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AdherenceWidget />

      {isLoading && (
        <View style={[styles.list, { gap: 10 }]}>
          {[1, 2, 3].map((k) => <DoseCardSkeleton key={k} />)}
        </View>
      )}
      {!isLoading && filtered.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={56} color={C.border} />
          <Text style={styles.emptyText}>Nenhuma dose para hoje</Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.emptyActionCard} onPress={() => router.push('/scan-prescription' as never)}>
              <Ionicons name="scan-outline" size={28} color={C.primary} />
              <Text style={styles.emptyActionTitle}>Escanear Receita</Text>
              <Text style={styles.emptyActionSub}>Fotografe e cadastre{'\n'}medicamentos automaticamente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyActionCard} onPress={() => router.push('/add-medicine' as never)}>
              <Ionicons name="add-circle-outline" size={28} color={C.primary} />
              <Text style={styles.emptyActionTitle}>Adicionar Manual</Text>
              <Text style={styles.emptyActionSub}>Digite os dados do{'\n'}medicamento manualmente</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {!isLoading && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={[C.primary]} />}
        />
      )}
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20,
    },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end', gap: 10 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
    headerDate: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, textTransform: 'capitalize' },
    profileChip: {
      marginTop: 10, alignSelf: 'flex-start',
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    profileChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    progressBox: { alignItems: 'flex-end', gap: 2 },
    progressLabel: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 22 },
    progressSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: -2 },
    progressTrack: {
      width: 56, height: 4, borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: '#fff' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scanBtn: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    addBtn: {
      backgroundColor: '#fff', width: 42, height: 42,
      borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    },
    filterRow: {
      flexDirection: 'row', backgroundColor: C.primary,
      paddingHorizontal: 16, paddingBottom: 14, paddingTop: 0, gap: 8,
    },
    filterTab: {
      flex: 1, paddingVertical: 7, borderRadius: 20,
      alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
    },
    filterTabActive: { backgroundColor: '#fff' },
    filterText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
    filterTextActive: { color: C.primary, fontWeight: '700' },
    list: { padding: 16, gap: 10 },
    loader: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
    emptyText: { fontSize: 16, color: C.sub },
    emptyActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    emptyActionCard: {
      flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16,
      alignItems: 'center', gap: 8,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    emptyActionTitle: { fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'center' },
    emptyActionSub: { fontSize: 11, color: C.sub, textAlign: 'center', lineHeight: 16 },
    card: {
      flexDirection: 'row', backgroundColor: C.card, borderRadius: 14,
      overflow: 'hidden', elevation: 2, shadowColor: '#000',
      shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    cardDone: { opacity: 0.65 },
    timeBar: { width: 4 },
    photo: { width: 44, height: 44, borderRadius: 8, alignSelf: 'center', marginLeft: 10 },
    cardBody: { flex: 1, padding: 14 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    time: { fontSize: 13, color: C.sub, fontWeight: '600' },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    medicineName: { fontSize: 16, fontWeight: '700', color: C.text },
    dosage: { fontSize: 13, color: C.sub, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 6 },
    checkBtn: {
      backgroundColor: C.success, width: 38, height: 38,
      borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    },
    skipBtn: {
      width: 32, height: 32, borderRadius: 16, borderWidth: 1,
      borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    editBtn: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
