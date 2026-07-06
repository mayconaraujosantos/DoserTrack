import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

export type SuccessToastPreset = 'quick' | 'normal' | 'withAction';

export const SUCCESS_TOAST_PRESETS: Record<
  SuccessToastPreset,
  { durationMs: number; placement: 'top' | 'bottom' }
> = {
  quick: { durationMs: 2200, placement: 'top' },
  normal: { durationMs: 2600, placement: 'top' },
  withAction: { durationMs: 5200, placement: 'bottom' },
};

interface SuccessToastProps {
  visible: boolean;
  title: string;
  message?: string;
  onHide: () => void;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  placement?: 'top' | 'bottom';
  preset?: SuccessToastPreset;
}

export function SuccessToast({
  visible,
  title,
  message,
  onHide,
  actionLabel,
  onAction,
  durationMs,
  placement,
  preset,
}: Readonly<SuccessToastProps>) {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const presetConfig = preset ? SUCCESS_TOAST_PRESETS[preset] : undefined;
  const resolvedDuration = durationMs ?? presetConfig?.durationMs ?? (actionLabel ? 5000 : 2600);
  const resolvedPlacement = placement ?? presetConfig?.placement ?? 'top';

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onHide();
      opacity.setValue(0);
      translateY.setValue(-16);
    }, resolvedDuration);

    return () => clearTimeout(timer);
  }, [onHide, opacity, resolvedDuration, translateY, visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <Animated.View
        style={[
          styles.container,
          {
            top: resolvedPlacement === 'bottom' ? undefined : insets.top + 10,
            bottom: resolvedPlacement === 'bottom' ? insets.bottom + 14 : undefined,
            backgroundColor: C.success,
            shadowColor: C.text,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text variant="label" color="#fff" style={styles.title}>
            {title}
          </Text>
        </View>

        {message ? (
          <Text variant="caption" color="#fff" style={styles.message}>
            {message}
          </Text>
        ) : null}

        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={() => {
              onAction();
              onHide();
              opacity.setValue(0);
              translateY.setValue(-16);
            }}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text variant="label" color="#fff">
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  message: {
    marginTop: 6,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
});
