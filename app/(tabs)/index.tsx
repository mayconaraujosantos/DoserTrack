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
import { DoseCardSkeleton } from '@/components/ui/skeleton';
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

  return (
    <View style={[styles.card, state === 'taken' && styles.cardDone]}>
      <View style={[styles.timeBar, { backgroundColor: color }]} />
      {dose.medicinePhotoUri ? (
        <Image source={{ uri: dose.medicinePhotoUri }} style={styles.photo} />
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.time}>{formatTime(dose.scheduledTime)}</Text>
          <View style={[styles.badge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.badgeText, { color }]}>{label}</Text>
          </View>
        </View>
        <Text style={styles.medicineName}>{dose.medicineName}</Text>
        {dose.dosage ? <Text style={styles.dosage}>{dose.dosage}</Text> : null}
      </View>
      {state !== 'taken' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.checkBtn} onPress={() => onCheck(dose.id)}>
            <Ionicons name="checkmark" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => onSkip(dose.id)}>
            <Ionicons name="close" size={18} color={C.sub} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(dose.id)}>
            <Ionicons name="pencil-outline" size={15} color={C.sub} />
          </TouchableOpacity>
        </View>
      )}
      {state === 'taken' && (
        <View style={styles.actions}>
          <Ionicons name="checkmark-circle" size={26} color={C.success} />
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(dose.id)}>
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] }),
  });

  const skipMutation = useMutation({
    mutationFn: (id: number) => updateDoseStatus(id, 'skipped'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doses'] }),
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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Hoje</Text>
          <Text style={styles.headerDate}>{dateLabel}</Text>
          {activeProfile ? (
            <TouchableOpacity onPress={() => router.push('/profiles' as never)} style={styles.profileChip}>
              <Ionicons name="people-outline" size={14} color={C.primary} />
              <Text style={styles.profileChipText}>{activeProfile.name}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-medicine' as never)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
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

      {isLoading && (
        <View style={[styles.list, { gap: 10 }]}>
          {[1, 2, 3].map((k) => <DoseCardSkeleton key={k} />)}
        </View>
      )}
      {!isLoading && filtered.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={56} color={C.border} />
          <Text style={styles.emptyText}>Nenhum medicamento aqui</Text>
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
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: C.card, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: C.text },
    headerDate: { fontSize: 13, color: C.sub, marginTop: 2, textTransform: 'capitalize' },
    profileChip: {
      marginTop: 10,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: C.primary + '12',
    },
    profileChipText: { color: C.primary, fontSize: 12, fontWeight: '700' },
    addBtn: {
      backgroundColor: C.primary, width: 42, height: 42,
      borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    },
    filterRow: {
      flexDirection: 'row', backgroundColor: C.card,
      paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 8,
    },
    filterTab: {
      flex: 1, paddingVertical: 7, borderRadius: 20,
      alignItems: 'center', backgroundColor: C.bg,
    },
    filterTabActive: { backgroundColor: C.primary },
    filterText: { fontSize: 12, color: C.sub, fontWeight: '500' },
    filterTextActive: { color: '#fff' },
    list: { padding: 16, gap: 10 },
    loader: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 16, color: C.sub },
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
