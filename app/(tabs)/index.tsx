import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getDosesForDate, getDosesForDateRange, updateDoseStatus } from '@/lib/database';
import { haptic } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import { syncToCloud } from '@/lib/sync';
import type { Dose } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Theme-aware palette ──────────────────────────────────────────────────────

const HOME_COLORS = {
  light: {
    bg: '#EAEBFF',
    primary: '#1B1F4B',
    card: '#FFFFFF',
    sub: '#9294B0',
    border: '#DFE0F0',
  },
  dark: {
    bg: '#0F1117',
    primary: '#E2E8F0',
    card: '#1C2333',
    sub: '#8899A6',
    border: '#253047',
  },
} as const;

type HomeColors = {
  readonly bg: string;
  readonly primary: string;
  readonly card: string;
  readonly sub: string;
  readonly border: string;
};

function useHomeColors(): HomeColors {
  const scheme = useColorScheme() ?? 'light';
  return HOME_COLORS[scheme];
}

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_COLOR = {
  taken: '#4ECDC4',
  late: '#FF6B6B',
  pending: '#F9C74F',
  snoozed: '#F4A261',
  skipped: '#9294B0',
} as const;

const STATUS_LABEL = {
  taken: 'Tomado',
  late: 'Atrasado',
  pending: 'Pendente',
  snoozed: 'Adiado',
  skipped: 'Pulado',
} as const;

type DisplayStatus = keyof typeof STATUS_COLOR;
type FilterKey = 'all' | 'pending' | 'taken' | 'late';

// ─── Day status (for calendar dots) ──────────────────────────────────────────

type DayStatus = 'all_taken' | 'has_late' | 'has_pending';

const STATUS_DOT_COLOR: Record<DayStatus, string> = {
  all_taken: '#4ECDC4',
  has_late: '#FF6B6B',
  has_pending: '#F9C74F',
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'taken', label: 'Tomados' },
  { key: 'late', label: 'Atrasados' },
];

// ─── Locale constants ─────────────────────────────────────────────────────────

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDisplayStatus(dose: Dose): DisplayStatus {
  if (dose.status === 'taken') return 'taken';
  if (dose.status === 'skipped') return 'skipped';
  if (dose.status === 'snoozed') return 'snoozed';
  if (new Date(dose.scheduledTime) < new Date()) return 'late';
  return 'pending';
}

function getSundayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return toLocalDateStr(d);
}

function buildWeekFromAnchor(anchorStr: string) {
  const anchor = new Date(anchorStr + 'T12:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    return { dateStr: toLocalDateStr(d), day: d.getDate(), dow: d.getDay() };
  });
}

// ─── DoseCard ─────────────────────────────────────────────────────────────────

function DoseCard({
  dose,
  onTake,
  onUntake,
  onPress,
}: Readonly<{
  dose: Dose;
  onTake: (dose: Dose) => void;
  onUntake: (dose: Dose) => void;
  onPress: (id: number) => void;
}>) {
  const C = useHomeColors();
  const displayStatus = getDisplayStatus(dose);
  const color = STATUS_COLOR[displayStatus];
  const isTaken = displayStatus === 'taken';
  const canToggle =
    displayStatus === 'taken' || displayStatus === 'pending' || displayStatus === 'late';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: C.card, shadowColor: C.primary },
        isTaken && styles.cardDone,
      ]}
      onPress={() => onPress(dose.id)}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${dose.medicineName}, ${STATUS_LABEL[displayStatus]}`}
      accessibilityState={{ checked: isTaken }}
    >
      <View style={[styles.cardBar, { backgroundColor: color }]} />
      <View style={[styles.cardImageBox, { backgroundColor: color + '28' }]}>
        {dose.medicinePhotoUri ? (
          <Image
            source={{ uri: dose.medicinePhotoUri }}
            style={styles.cardImage}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="medical" size={26} color={color} />
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text variant="title" style={{ fontSize: 15, color: C.primary }} numberOfLines={1}>
          {dose.medicineName}
        </Text>
        {dose.dosage ? (
          <Text variant="caption" style={{ color: C.sub }} numberOfLines={1}>
            {dose.dosage}
          </Text>
        ) : null}
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[displayStatus]}</Text>
        </View>
      </View>
      {canToggle && (
        <Switch
          value={isTaken}
          onValueChange={val => (val ? onTake(dose) : onUntake(dose))}
          trackColor={{ false: C.border, true: color }}
          thumbColor={C.card}
          style={styles.switch}
          accessibilityLabel={isTaken ? 'Marcar como não tomado' : 'Marcar como tomado'}
        />
      )}
    </TouchableOpacity>
  );
}

// ─── DayCell ──────────────────────────────────────────────────────────────────

function DayCell({
  dateStr,
  day,
  dow,
  isSelected,
  isToday,
  status,
  onPress,
  C,
}: Readonly<{
  dateStr: string;
  day: number;
  dow: number;
  isSelected: boolean;
  isToday: boolean;
  status?: DayStatus;
  onPress: (d: string) => void;
  C: HomeColors;
}>) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.dayCellFlex}
      onPress={() => {
        scale.value = withSequence(
          withSpring(0.82, { duration: 80 }),
          withSpring(1, { duration: 200 })
        );
        onPress(dateStr);
      }}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`Dia ${day}`}
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View
        style={[
          styles.dayCellInner,
          isSelected && [
            styles.dateCellSelected,
            { backgroundColor: C.primary, shadowColor: C.primary },
          ],
          animStyle,
        ]}
      >
        <Text style={[styles.dateDayNum, { color: isSelected ? C.card : C.primary }]}>
          {String(day).padStart(2, '0')}
        </Text>
        <Text style={[styles.dateDow, { color: isSelected ? C.card + 'B8' : C.sub }]}>
          {DAYS_SHORT[dow]}
        </Text>
        <View style={styles.dayCellDotRow}>
          {isToday && !isSelected && (
            <View style={[styles.todayDot, { backgroundColor: C.primary }]} />
          )}
          {status && (
            <View style={[styles.statusDot, { backgroundColor: STATUS_DOT_COLOR[status] }]} />
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── DashboardScreen ──────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const C = useHomeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const dbReady = useAppStore(s => s.dbReady);
  const selectedDate = useAppStore(s => s.selectedDate);
  const setSelectedDate = useAppStore(s => s.setSelectedDate);
  const activeProfile = useAppStore(s => s.activeProfile);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const [weekAnchor, setWeekAnchor] = useState(() => getSundayOf(selectedDate));
  const weekDays = useMemo(() => buildWeekFromAnchor(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => weekDays[6]?.dateStr ?? weekAnchor, [weekDays, weekAnchor]);
  const selectedDateObj = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate]);

  const {
    data: doses = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['doses', selectedDate],
    queryFn: () => getDosesForDate(selectedDate),
    enabled: dbReady,
  });

  const { data: weekDoses = [] } = useQuery({
    queryKey: ['week-doses', weekAnchor],
    queryFn: () => getDosesForDateRange(weekAnchor, weekEnd),
    enabled: dbReady,
  });

  const dayStatusMap = useMemo<Record<string, DayStatus>>(() => {
    const byDate = weekDoses.reduce<Record<string, Dose[]>>((acc, dose) => {
      const date = dose.scheduledTime.slice(0, 10);
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(dose);
      return acc;
    }, {});
    const result: Record<string, DayStatus> = {};
    for (const [date, dosesOnDay] of Object.entries(byDate)) {
      const statuses = dosesOnDay.map(d => getDisplayStatus(d));
      if (statuses.includes('late')) result[date] = 'has_late';
      else if (statuses.every(s => s === 'taken')) result[date] = 'all_taken';
      else result[date] = 'has_pending';
    }
    return result;
  }, [weekDoses]);

  function goToPrevWeek() {
    const d = new Date(weekAnchor + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    const newAnchor = toLocalDateStr(d);
    setWeekAnchor(newAnchor);
    const selDow = new Date(selectedDate + 'T12:00:00').getDay();
    const newSel = new Date(d);
    newSel.setDate(d.getDate() + selDow);
    setSelectedDate(toLocalDateStr(newSel));
    haptic.light();
  }

  function goToNextWeek() {
    const d = new Date(weekAnchor + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    const newAnchor = toLocalDateStr(d);
    setWeekAnchor(newAnchor);
    const selDow = new Date(selectedDate + 'T12:00:00').getDay();
    const newSel = new Date(d);
    newSel.setDate(d.getDate() + selDow);
    setSelectedDate(toLocalDateStr(newSel));
    haptic.light();
  }

  function goToToday() {
    setWeekAnchor(getSundayOf(todayStr));
    setSelectedDate(todayStr);
    haptic.medium();
  }

  const takeMutation = useMutation({
    mutationFn: (id: number) => updateDoseStatus(id, 'taken', new Date().toISOString()),
    onSuccess: () => {
      haptic.success();
      syncToCloud().catch(console.error);
      qc.invalidateQueries({ queryKey: ['doses'] });
    },
  });

  const undoneMutation = useMutation({
    mutationFn: (id: number) => updateDoseStatus(id, 'pending'),
    onSuccess: () => {
      haptic.warning();
      syncToCloud().catch(console.error);
      qc.invalidateQueries({ queryKey: ['doses'] });
    },
  });

  function markTaken(dose: Dose) {
    takeMutation.mutate(dose.id);
  }
  function markUndone(dose: Dose) {
    undoneMutation.mutate(dose.id);
  }

  const filteredDoses = useMemo(() => {
    let result = doses;
    if (search.trim()) {
      result = result.filter(d => d.medicineName?.toLowerCase().includes(search.toLowerCase()));
    }
    if (activeFilter === 'taken') {
      result = result.filter(d => getDisplayStatus(d) === 'taken');
    } else if (activeFilter === 'pending') {
      result = result.filter(d => {
        const s = getDisplayStatus(d);
        return s === 'pending' || s === 'snoozed';
      });
    } else if (activeFilter === 'late') {
      result = result.filter(d => getDisplayStatus(d) === 'late');
    }
    return result;
  }, [doses, search, activeFilter]);

  const filterCounts = useMemo(
    () => ({
      all: doses.length,
      taken: doses.filter(d => getDisplayStatus(d) === 'taken').length,
      pending: doses.filter(d => {
        const s = getDisplayStatus(d);
        return s === 'pending' || s === 'snoozed';
      }).length,
      late: doses.filter(d => getDisplayStatus(d) === 'late').length,
    }),
    [doses]
  );

  const monthLabel = `${MONTHS_PT[selectedDateObj.getMonth()]} ${selectedDateObj.getFullYear()}`;
  const dateLabel = selectedDateObj.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  });
  const greeting = activeProfile?.name ? `Olá, ${activeProfile.name.split(' ')[0]}!` : 'Olá!';

  return (
    <View style={[styles.container, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: C.primary }]}>
            <Ionicons name="medical" size={16} color={C.card} />
          </View>
          <Text style={[styles.logoText, { color: C.primary }]}>Doser</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: C.card, shadowColor: C.primary }]}
            onPress={() => router.push('/scan-prescription')}
            accessibilityLabel="Escanear receita"
            accessibilityRole="button"
          >
            <Ionicons name="scan-outline" size={20} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/profiles')}
            accessibilityLabel="Perfis"
            accessibilityRole="button"
          >
            {activeProfile ? (
              <View style={[styles.avatarInner, { backgroundColor: activeProfile.color + '33' }]}>
                <Text style={[styles.avatarInitial, { color: activeProfile.color }]}>
                  {activeProfile.name[0]?.toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={[styles.avatarInner, { backgroundColor: C.primary + '22' }]}>
                <Ionicons name="person" size={18} color={C.primary} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Greeting (fixo) ────────────────────────────────────────────── */}
      <View style={styles.greetingSection}>
        <Text style={[styles.dateSmall, { color: C.sub }]}>{dateLabel}</Text>
        <Text style={[styles.greetingText, { color: C.primary }]}>{greeting}</Text>
      </View>

      {/* ── Search (fixo) ──────────────────────────────────────────────── */}
      <View style={[styles.searchWrap, { backgroundColor: C.card, shadowColor: C.primary }]}>
        <Ionicons name="search-outline" size={17} color={C.sub} />
        <TextInput
          style={[styles.searchInput, { color: C.primary }]}
          placeholder="Buscar medicamento..."
          placeholderTextColor={C.sub}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={17} color={C.sub} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Month nav ──────────────────────────────────────────────────── */}
      <View style={styles.monthRow}>
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={goToPrevWeek}
            accessibilityLabel="Semana anterior"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={16} color={C.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: C.primary }]}>{monthLabel}</Text>
          <TouchableOpacity
            style={styles.weekNavBtn}
            onPress={goToNextWeek}
            accessibilityLabel="Próxima semana"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-forward" size={16} color={C.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.monthRight}>
          {selectedDate !== todayStr && (
            <TouchableOpacity
              style={[styles.todayBtn, { borderColor: C.primary }]}
              onPress={goToToday}
              accessibilityLabel="Ir para hoje"
              accessibilityRole="button"
            >
              <Text style={[styles.todayBtnText, { color: C.primary }]}>Hoje</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addMedBtn, { backgroundColor: C.primary }]}
            onPress={() => router.push('/add-medicine')}
            accessibilityLabel="Adicionar medicamento"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color={C.card} />
            <Text style={[styles.addMedText, { color: C.card }]}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Date strip ─────────────────────────────────────────────────── */}
      <View style={styles.dateStripWrapper}>
        {weekDays.map(({ dateStr, day, dow }) => (
          <DayCell
            key={dateStr}
            dateStr={dateStr}
            day={day}
            dow={dow}
            isSelected={dateStr === selectedDate}
            isToday={dateStr === todayStr}
            status={dayStatusMap[dateStr]}
            onPress={setSelectedDate}
            C={C}
          />
        ))}
      </View>

      {/* ── Filter chips (fixo, scroll horizontal) ─────────────────────── */}
      <View style={styles.filterStripWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterStrip}
        >
          {FILTERS.map(({ key, label }) => {
            const active = activeFilter === key;
            const count = filterCounts[key];
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? C.primary : C.card,
                    shadowColor: C.primary,
                  },
                ]}
                onPress={() => setActiveFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, { color: active ? C.card : C.sub }]}>
                  {label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.filterBadge,
                      {
                        backgroundColor: active ? C.card + '33' : C.primary + '18',
                      },
                    ]}
                  >
                    <Text style={[styles.filterBadgeText, { color: active ? C.card : C.primary }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Timeline (único trecho que faz scroll) ─────────────────────── */}
      <ScrollView
        style={styles.timelineScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            colors={[C.primary]}
            tintColor={C.primary}
          />
        }
        contentContainerStyle={styles.timelineContent}
      >
        {!isLoading && filteredDoses.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={52} color={C.border} />
            <Text style={[styles.emptyTitle, { color: C.sub }]}>
              {search ? 'Nenhum resultado' : 'Sem doses para este dia'}
            </Text>
            {!search && (
              <TouchableOpacity
                style={[styles.emptyAddBtn, { backgroundColor: C.primary }]}
                onPress={() => router.push('/add-medicine')}
              >
                <Text style={[styles.emptyAddText, { color: C.card }]}>Adicionar medicamento</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {filteredDoses.map((dose, index) => {
          const isLast = index === filteredDoses.length - 1;
          const dotColor = STATUS_COLOR[getDisplayStatus(dose)];
          const time = formatTime(dose.scheduledTime);
          return (
            <View key={dose.id} style={styles.timelineRow}>
              {/* Left: time + dot + line */}
              <View style={styles.timelineLeft}>
                <Text style={[styles.timeLabel, { color: C.sub }]}>{time}</Text>
                <View style={styles.dotCol}>
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                  {!isLast && <View style={[styles.line, { backgroundColor: C.border }]} />}
                </View>
              </View>
              {/* Right: dose card */}
              <View style={styles.timelineRight}>
                <DoseCard
                  dose={dose}
                  onTake={markTaken}
                  onUntake={markUndone}
                  onPress={id => router.push(`/edit-dose?id=${id}`)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles (layout only — colors applied inline via theme) ───────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  timelineScroll: { flex: 1 },
  timelineContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarBtn: {},
  avatarInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 17, fontWeight: '800' },

  // Greeting
  greetingSection: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  dateSmall: { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  greetingText: { fontSize: 30, fontWeight: '800', marginTop: 2 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15 },

  // Month nav
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthText: { fontSize: 16, fontWeight: '700' },
  weekNavBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  todayBtnText: { fontSize: 12, fontWeight: '700' },
  addMedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  addMedText: { fontSize: 13, fontWeight: '700' },

  // Date strip
  dateStripWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  dayCellFlex: { flex: 1, alignItems: 'center' },
  dayCellInner: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 18,
    gap: 2,
    width: '100%',
  },
  dateCellSelected: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  dateDayNum: { fontSize: 15, fontWeight: '700' },
  dateDow: { fontSize: 10, fontWeight: '600' },
  dayCellDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 7,
    marginTop: 2,
  },
  todayDot: { width: 5, height: 5, borderRadius: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },

  // Filter chips
  filterStripWrapper: { height: 44, marginTop: 6, overflow: 'hidden' },
  filterStrip: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 5,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700' },

  // Timeline
  timelineRow: { flexDirection: 'row' },
  timelineLeft: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  timeLabel: { fontSize: 11, fontWeight: '600', width: 50, textAlign: 'right' },
  dotCol: { alignItems: 'center', marginHorizontal: 10, alignSelf: 'stretch' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 1.5, flex: 1, marginTop: 4 },
  timelineRight: { flex: 1 },

  // Dose card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    minHeight: 76,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardDone: { opacity: 0.65 },
  cardBar: { width: 5, alignSelf: 'stretch' },
  cardImageBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: { width: 52, height: 52, borderRadius: 12 },
  cardInfo: { flex: 1, paddingVertical: 10, paddingRight: 4, gap: 3 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  switch: { marginRight: 14 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 44, gap: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
  emptyAddBtn: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 20,
    marginTop: 4,
  },
  emptyAddText: { fontWeight: '700', fontSize: 14 },
});
