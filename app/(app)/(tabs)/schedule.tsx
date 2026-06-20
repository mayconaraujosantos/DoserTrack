import { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDosesForDate, getDatesWithDosesInMonth } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';
import { ScreenHeader, headerBtnStyle } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import type { Dose } from '@/types';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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

// ─── DoseItem ─────────────────────────────────────────────────────────────────

function DoseItem({ item }: Readonly<{ item: Dose }>) {
  const C = useTheme();

  const DOT_COLOR: Record<string, string> = {
    taken: C.success,
    skipped: C.danger,
  };
  const dotColor = DOT_COLOR[item.status] ?? C.primary;

  return (
    <Card variant="flat" style={styles.doseItem}>
      <View style={[styles.doseTime, { backgroundColor: dotColor + '18' }]}>
        <Text variant="label" color={dotColor}>
          {formatTime(item.scheduledTime)}
        </Text>
      </View>
      <View style={styles.doseInfo}>
        <Text variant="body" style={styles.doseName}>
          {item.medicineName}
        </Text>
        {item.dosage ? (
          <Text variant="caption" style={styles.doseDosage}>
            {item.dosage}
          </Text>
        ) : null}
      </View>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
    </Card>
  );
}

// ─── ScheduleScreen ───────────────────────────────────────────────────────────

const CELL_SIZE = 44;

export default function ScheduleScreen() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const C = useTheme();

  const selectedDate = useAppStore(s => s.selectedDate);
  const setSelectedDate = useAppStore(s => s.setSelectedDate);
  const dbReady = useAppStore(s => s.dbReady);
  const router = useRouter();

  const { data: doses = [], isLoading } = useQuery({
    queryKey: ['doses', selectedDate],
    queryFn: () => getDosesForDate(selectedDate),
    enabled: dbReady,
  });

  const { data: datesWithDoses = new Set<string>() } = useQuery({
    queryKey: ['datesWithDoses', viewYear, viewMonth],
    queryFn: () => getDatesWithDosesInMonth(viewYear, viewMonth),
    enabled: dbReady,
  });

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
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
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <ScreenHeader
        title="Agenda"
        right={
          <TouchableOpacity
            style={headerBtnStyle.iconOnly}
            onPress={() => router.push('/add-medicine')}
            accessibilityLabel="Adicionar medicamento"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        }
      />

      {/* Calendar */}
      <Card variant="default" style={styles.calendarCard}>
        <View style={styles.calNav}>
          <TouchableOpacity
            onPress={prevMonth}
            style={styles.navBtn}
            accessibilityLabel="Mês anterior"
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text variant="title">
            {MONTHS_PT[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={styles.navBtn}
            accessibilityLabel="Próximo mês"
          >
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {DAYS_PT.map(d => (
            <Text key={d} variant="caption" color={C.sub} style={styles.weekDay}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null)
              return <View key={`empty-${viewYear}-${viewMonth}-${idx}`} style={styles.cell} />;
            const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasDoses = datesWithDoses.has(dateStr);
            const dayNumColor = isSelected ? '#fff' : isToday ? C.primary : C.text;
            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.cell,
                  isToday && [styles.todayCell, { borderColor: C.primary }],
                  isSelected && [styles.selectedCell, { backgroundColor: C.primary }],
                ]}
                onPress={() => setSelectedDate(dateStr)}
                accessibilityLabel={`${day} de ${MONTHS_PT[viewMonth]}${hasDoses ? ', tem doses' : ''}`}
                accessibilityHint={isSelected ? 'Dia selecionado' : 'Toque para ver doses'}
              >
                <Text
                  variant="body"
                  color={dayNumColor}
                  style={isSelected || isToday ? styles.dayNumBold : undefined}
                >
                  {day}
                </Text>
                {hasDoses && !isSelected && (
                  <View
                    style={[styles.doseDot, { backgroundColor: isToday ? C.primary : C.sub }]}
                  />
                )}
                {hasDoses && isSelected && (
                  <View style={[styles.doseDot, { backgroundColor: 'rgba(255,255,255,0.7)' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Selected date header */}
      <View style={styles.selectedHeader}>
        <Text variant="label" style={styles.capitalize}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
        <Text variant="caption" color={C.sub}>
          {doses.length} dose{doses.length === 1 ? '' : 's'}
        </Text>
      </View>

      {isLoading && <ActivityIndicator style={styles.loader} color={C.primary} />}

      {!isLoading && doses.length === 0 && (
        <View style={styles.empty}>
          <Text variant="body" color={C.sub}>
            Sem doses nesse dia
          </Text>
        </View>
      )}

      {!isLoading && doses.length > 0 && (
        <FlatList
          data={doses}
          keyExtractor={item => String(item.id)}
          renderItem={renderDose}
          contentContainerStyle={styles.doseList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  calendarCard: { marginHorizontal: 16, marginTop: 12 },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { padding: 6 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  todayCell: { borderWidth: 1.5, borderRadius: 20 },
  selectedCell: { borderRadius: 20 },
  dayNumBold: { fontWeight: '700' },
  doseDot: { width: 4, height: 4, borderRadius: 2 },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  capitalize: { textTransform: 'capitalize' },
  doseList: { paddingHorizontal: 16, gap: 8 },
  loader: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 24 },
  // DoseItem
  doseItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doseTime: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  doseInfo: { flex: 1 },
  doseName: { fontWeight: '600' },
  doseDosage: { marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
