import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getWeekAdherence, getAdherenceStreak } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/components/ui/Text';

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function rateColor(
  rate: number,
  success: string,
  warning: string,
  danger: string,
  border: string
): string {
  if (rate >= 0.8) return success;
  if (rate >= 0.5) return warning;
  if (rate > 0) return danger;
  return border;
}

export function AdherenceWidget() {
  const C = useTheme();
  const dbReady = useAppStore(s => s.dbReady);

  const { data: week = [] } = useQuery({
    queryKey: ['week-adherence'],
    queryFn: getWeekAdherence,
    enabled: dbReady,
  });

  const { data: streak = 0 } = useQuery({
    queryKey: ['streak'],
    queryFn: getAdherenceStreak,
    enabled: dbReady,
  });

  const last7 = useMemo(() => {
    const map = new Map(week.map(d => [d.date, d]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      return { key, label: DAY_LABELS[dow], data: map.get(key) };
    });
  }, [week]);

  if (week.length === 0 && streak === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.streakRow}>
        <Ionicons name="flame" size={18} color={streak > 0 ? C.warning : C.border} />
        <Text variant="title" color={streak > 0 ? C.warning : C.sub} style={styles.streakCount}>
          {streak}
        </Text>
        <Text variant="caption" color={C.sub}>
          {streak === 1 ? 'dia consecutivo' : 'dias consecutivos'}
        </Text>
      </View>

      <View style={styles.bars}>
        {last7.map(({ key, label, data }) => {
          const rate = data?.rate ?? -1;
          const hasData = rate >= 0;
          const color = hasData
            ? rateColor(rate, C.success, C.warning, C.danger, C.border)
            : C.border;
          const height = hasData && rate > 0 ? Math.max(6, Math.round(rate * 32)) : 6;
          return (
            <View key={key} style={styles.barCol}>
              <View style={[styles.barTrack, { backgroundColor: C.bg }]}>
                <View style={[styles.barFill, { height, backgroundColor: color }]} />
              </View>
              <Text variant="caption" color={C.sub} style={styles.barLabel}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  streakCount: { fontSize: 20, fontWeight: '800' },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', gap: 6, flex: 1 },
  barTrack: {
    width: 20,
    height: 32,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { fontWeight: '500' },
});
