import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Text } from './Text';
import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, left, right }: Readonly<ScreenHeaderProps>) {
  const insets = useSafeAreaInsets();
  const C = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14, backgroundColor: C.primary }]}>
      <View style={styles.row}>
        {left ? <View style={styles.side}>{left}</View> : null}
        <View style={styles.center}>
          <Text
            style={styles.title}
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.1} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={[styles.side, styles.rightSide]}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Botão de ação leve para usar dentro do ScreenHeader (fundo branco translúcido). */
export const headerBtnStyle = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconOnly: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  center: { flex: 1, gap: 2 },
  side: { minWidth: 40 },
  rightSide: { alignItems: 'flex-end' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    color: '#fff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: 'rgba(255,255,255,0.72)',
  },
});
