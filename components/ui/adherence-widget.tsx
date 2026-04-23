import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getWeekAdherence, getAdherenceStreak } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function rateColor(rate: number, C: ThemeColors): string {
  if (rate >= 0.8) return C.success;
  if (rate >= 0.5) return C.warning;
  if (rate > 0) return C.danger;
  return C.border;
}

export function AdherenceWidget() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const dbReady = useAppStore((s) => s.dbReady);

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
    const map = new Map(week.map((d) => [d.date, d]));
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
    <View style={styles.container}>
      <View style={styles.streakRow}>
        <Ionicons name="flame" size={18} color={streak > 0 ? C.warning : C.border} />
        <Text style={[styles.streakCount, { color: streak > 0 ? C.warning : C.sub }]}>
          {streak}
        </Text>
        <Text style={styles.streakLabel}>
          {streak === 1 ? 'dia consecutivo' : 'dias consecutivos'}
        </Text>
      </View>

      <View style={styles.bars}>
        {last7.map(({ key, label, data }) => {
          const rate = data?.rate ?? -1;
          const hasData = rate >= 0;
          const color = hasData ? rateColor(rate, C) : C.border;
          const height = hasData && rate > 0 ? Math.max(6, Math.round(rate * 32)) : 6;
          return (
            <View key={key} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height, backgroundColor: color }]} />
              </View>
              <Text style={styles.barLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: C.card, borderRadius: 16, padding: 16, marginHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
    streakCount: { fontSize: 20, fontWeight: '800' },
    streakLabel: { fontSize: 13, color: C.sub, fontWeight: '500' },
    bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    barCol: { alignItems: 'center', gap: 6, flex: 1 },
    barTrack: {
      width: 20, height: 32, borderRadius: 6,
      backgroundColor: C.bg, justifyContent: 'flex-end', overflow: 'hidden',
    },
    barFill: { width: '100%', borderRadius: 6 },
    barLabel: { fontSize: 11, color: C.sub, fontWeight: '500' },
  });
}
