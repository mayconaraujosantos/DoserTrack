import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

export type IconButtonVariant = 'default' | 'primary' | 'danger' | 'success' | 'ghost';

interface IconButtonProps extends TouchableOpacityProps {
  name: keyof typeof Ionicons.glyphMap;
  variant?: IconButtonVariant;
  size?: number;
  /** Override button container size */
  boxSize?: number;
}

export function IconButton({
  name,
  variant = 'default',
  size = 18,
  boxSize = 36,
  style,
  accessibilityLabel,
  ...rest
}: IconButtonProps) {
  const C = useTheme();

  const BG: Record<IconButtonVariant, string> = {
    default: C.sub + '18',
    primary: C.primary + '18',
    danger: C.danger + '18',
    success: C.success + '18',
    ghost: 'transparent',
  };

  const ICON_COLOR: Record<IconButtonVariant, string> = {
    default: C.sub,
    primary: C.primary,
    danger: C.danger,
    success: C.success,
    ghost: C.sub,
  };

  const radius = boxSize / 2.5;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { width: boxSize, height: boxSize, borderRadius: radius, backgroundColor: BG[variant] },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.7}
      {...rest}
    >
      <Ionicons name={name} size={size} color={ICON_COLOR[variant]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
