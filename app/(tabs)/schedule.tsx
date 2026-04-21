import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDosesForDate } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import type { Dose } from '@/types';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function doseStatusColor(item: Dose, C: ThemeColors): string {
  if (item.status === 'taken') return C.success;
  if (item.status === 'skipped') return C.danger;
  return C.primary;
}

function DoseItem({ item }: Readonly<{ item: Dose }>) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const color = doseStatusColor(item, C);

  return (
    <View style={styles.doseItem}>
      <View style={[styles.doseTime, { backgroundColor: color + '18' }]}>
        <Text style={[styles.doseTimeText, { color }]}>
          {formatTime(item.scheduledTime)}
        </Text>
      </View>
      <View style={styles.doseInfo}>
        <Text style={styles.doseName}>{item.medicineName}</Text>
        {item.dosage ? <Text style={styles.doseDosage}>{item.dosage}</Text> : null}
      </View>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
    </View>
  );
}

export default function ScheduleScreen() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const dbReady = useAppStore((s) => s.dbReady);
  const router = useRouter();

  const { data: doses = [], isLoading } = useQuery({
    queryKey: ['doses', selectedDate],
    queryFn: () => getDosesForDate(selectedDate),
    enabled: dbReady,
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = toDateStr(today);

  const cells: (number | null)[] = [
    ...new Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const renderDose = useCallback(
    ({ item }: ListRenderItemInfo<Dose>) => <DoseItem item={item} />,
    []
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Agenda</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-medicine' as never)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.calNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTHS_PT[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {DAYS_PT.map((d) => (
            <Text key={d} style={styles.weekDay}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`empty-col-${viewYear}-${viewMonth}-${idx}`} style={styles.cell} />;
            const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.cell,
                  isToday && styles.todayCell,
                  isSelected && styles.selectedCell,
                ]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[
                  styles.dayNum,
                  isToday && styles.todayText,
                  isSelected && styles.selectedText,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.selectedHeader}>
        <Text style={styles.selectedDateLabel}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>
        <Text style={styles.doseCount}>{doses.length} dose{doses.length === 1 ? '' : 's'}</Text>
      </View>

      {isLoading && <ActivityIndicator style={styles.loader} color={C.primary} />}
      {!isLoading && doses.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sem doses nesse dia</Text>
        </View>
      )}
      {!isLoading && doses.length > 0 && (
        <FlatList
          data={doses}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDose}
          contentContainerStyle={styles.doseList}
        />
      )}
    </View>
  );
}

const CELL_SIZE = 40;

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: C.card, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: C.text },
    addBtn: {
      backgroundColor: C.primary, width: 42, height: 42,
      borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    },
    calendarCard: {
      backgroundColor: C.card, marginHorizontal: 16, marginTop: 12,
      borderRadius: 16, padding: 16, elevation: 2,
      shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    navBtn: { padding: 6 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: C.text },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekDay: { flex: 1, textAlign: 'center', fontSize: 12, color: C.sub, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
    todayCell: { borderWidth: 1.5, borderColor: C.primary, borderRadius: 20 },
    selectedCell: { backgroundColor: C.primary, borderRadius: 20 },
    dayNum: { fontSize: 14, color: C.text },
    todayText: { color: C.primary, fontWeight: '700' },
    selectedText: { color: '#fff', fontWeight: '700' },
    selectedHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 12,
    },
    selectedDateLabel: { fontSize: 14, fontWeight: '600', color: C.text, textTransform: 'capitalize' },
    doseCount: { fontSize: 13, color: C.sub },
    doseList: { paddingHorizontal: 16, gap: 8 },
    loader: { flex: 1 },
    empty: { alignItems: 'center', paddingTop: 24 },
    emptyText: { fontSize: 15, color: C.sub },
    doseItem: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
      borderRadius: 12, padding: 12, gap: 10, elevation: 1,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    },
    doseTime: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 56, alignItems: 'center' },
    doseTimeText: { fontSize: 13, fontWeight: '700' },
    doseInfo: { flex: 1 },
    doseName: { fontSize: 15, fontWeight: '600', color: C.text },
    doseDosage: { fontSize: 12, color: C.sub, marginTop: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
  });
}
