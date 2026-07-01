import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Right-side accessory (e.g. unit badge) */
  accessory?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  accessory,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const C = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error ? C.danger : isFocused ? C.primary : C.border;
  const borderWidth = error || isFocused ? 1.5 : StyleSheet.hairlineWidth;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.row,
          {
            backgroundColor: C.card,
            borderColor,
            borderWidth,
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? C.primary : C.sub}
            style={styles.icon}
          />
        ) : null}

        <TextInput
          style={[styles.input, { color: C.text }, style]}
          placeholderTextColor={C.sub}
          onFocus={e => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {accessory}
      </View>

      {error ? (
        <Text variant="caption" color={C.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, height: '100%' },
  error: { marginTop: 2 },
});
