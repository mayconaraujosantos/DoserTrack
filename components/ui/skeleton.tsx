import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, style }: Props) {
  const C = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as number, height, borderRadius, backgroundColor: C.border, opacity },
        style,
      ]}
    />
  );
}

export function DoseCardSkeleton() {
  const C = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: C.card }]}>
      <View style={[styles.bar, { backgroundColor: C.border }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Skeleton width={60} height={12} borderRadius={6} />
          <Skeleton width={64} height={20} borderRadius={10} />
        </View>
        <Skeleton width={140} height={16} borderRadius={8} style={{ marginTop: 8 }} />
        <Skeleton width={90} height={12} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.actionArea}>
        <Skeleton width={38} height={38} borderRadius={19} />
      </View>
    </View>
  );
}

export function MedicineCardSkeleton() {
  const C = useTheme();
  return (
    <View style={[styles.medCard, { backgroundColor: C.card }]}>
      <Skeleton width={48} height={48} borderRadius={12} />
      <View style={styles.medBody}>
        <Skeleton width={120} height={16} borderRadius={8} />
        <Skeleton width={70} height={12} borderRadius={6} style={{ marginTop: 6 }} />
        <Skeleton width={90} height={11} borderRadius={5} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  card: {
    flexDirection: 'row', borderRadius: 14, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.07,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  bar: { width: 4 },
  body: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionArea: { paddingRight: 12, alignSelf: 'center' },
  medCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, gap: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  medBody: { flex: 1 },
});
