import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 52 };
const FONT_SIZE: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };
const H_PAD: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 22 };
const RADIUS: Record<ButtonSize, number> = { sm: 10, md: 12, lg: 14 };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const C = useTheme();

  const BG: Record<ButtonVariant, string> = {
    primary: C.primary,
    secondary: C.card,
    ghost: 'transparent',
    danger: C.danger,
  };

  const TEXT_COLOR: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: C.text,
    ghost: C.primary,
    danger: '#fff',
  };

  const BORDER: Record<ButtonVariant, string | undefined> = {
    primary: undefined,
    secondary: C.border,
    ghost: undefined,
    danger: undefined,
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: H_PAD[size],
          borderRadius: RADIUS[size],
          backgroundColor: BG[variant],
          borderWidth: BORDER[variant] ? StyleSheet.hairlineWidth : 0,
          borderColor: BORDER[variant],
          opacity: isDisabled ? 0.55 : 1,
        },
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={TEXT_COLOR[variant]} size="small" />
      ) : (
        <>
          {icon}
          <Text
            variant="label"
            style={{ color: TEXT_COLOR[variant], fontSize: FONT_SIZE[size], fontWeight: '700' }}
          >
            {children}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
