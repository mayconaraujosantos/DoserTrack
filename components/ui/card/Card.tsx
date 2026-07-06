import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, View, type ViewProps } from 'react-native';

export type CardVariant = 'default' | 'flat' | 'outlined';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: number;
}

export function Card({ variant = 'default', padding = 14, style, children, ...rest }: CardProps) {
  const C = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: C.card,
          borderRadius: 14,
          padding,
          borderWidth: variant === 'outlined' ? 1.5 : StyleSheet.hairlineWidth,
          borderColor: C.border,
        },
        variant === 'default' && styles.shadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  shadow: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
