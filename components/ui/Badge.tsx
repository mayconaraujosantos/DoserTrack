import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, View, type ViewProps } from 'react-native';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  label: string;
  dot?: boolean;
}

export function Badge({ variant = 'neutral', label, dot = false, style, ...rest }: BadgeProps) {
  const C = useTheme();

  const COLOR: Record<BadgeVariant, string> = {
    primary: C.primary,
    success: C.success,
    warning: C.warning,
    danger: C.danger,
    neutral: C.sub,
  };

  const color = COLOR[variant];

  return (
    <View style={[styles.base, { backgroundColor: color + '1A' }, style]} {...rest}>
      {dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text variant="caption" style={{ color, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
