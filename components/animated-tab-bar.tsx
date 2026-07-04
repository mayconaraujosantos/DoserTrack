import React, { useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColors } from '@/constants/theme';

const SPRING = { damping: 20, stiffness: 260, mass: 0.9 };

const PILL_H = 68;
const CIRCLE_D = 54;
const ACTION_D = 74;
const OVERLAP = 22;
const BORDER_W = 4;

type IconFn = (props: { focused: boolean; color: string; size: number }) => React.ReactNode;

// ── Aba dentro da pill ───────────────────────────────────────────────────────

type PillItemProps = {
  label: string;
  icon?: IconFn;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  C: ThemeColors;
};

function PillItem({ label, icon, isFocused, onPress, onLongPress, C }: PillItemProps) {
  const progress = useSharedValue(isFocused ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
  }, [isFocused, progress]);

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.88, SPRING);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, SPRING);
  }, [pressScale]);

  const itemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(255,255,255,0.15)', '#F5F5F5']
    ),
  }));

  const iconColor = isFocused ? C.navDark : '#FFFFFF';

  return (
    <Animated.View style={[s.pillItem, itemStyle]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={s.pillPressable}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}
      >
        <View style={s.iconWrapper}>
          <Animated.View style={[s.circle, circleStyle]} />
          {icon?.({ focused: isFocused, color: iconColor, size: 22 })}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Botão de ação fixo (abre Quick Actions Sheet) ────────────────────────────

type ActionButtonProps = {
  onPress: () => void;
  C: ThemeColors;
};

function ActionButton({ onPress, C }: ActionButtonProps) {
  const pressScale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.88, SPRING);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, SPRING);
  }, [pressScale]);

  const itemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View style={[s.actionWrapper, itemStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[s.actionButton, { backgroundColor: C.navAction, borderColor: C.bg }]}
        accessibilityRole="button"
        accessibilityLabel="Ações rápidas"
      >
        <Ionicons name="scan-outline" size={26} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

// ── Tab bar principal ────────────────────────────────────────────────────────

export type AnimatedTabBarProps = BottomTabBarProps & {
  onActionPress: () => void;
};

export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  insets,
  onActionPress,
}: AnimatedTabBarProps) {
  const C = useTheme();

  const getProps = (index: number) => {
    const route = state.routes[index];
    const options = descriptors[route.key].options;
    const label = (options.tabBarLabel as string | undefined) ?? options.title ?? route.name;
    const isFocused = state.index === index;
    const icon = options.tabBarIcon as IconFn | undefined;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

    return { key: route.key, label, isFocused, icon, onPress, onLongPress };
  };

  return (
    <View
      style={[
        s.wrapper,
        { backgroundColor: C.bg, paddingBottom: Math.max(insets.bottom + 12, 24) },
      ]}
    >
      <View style={s.row}>
        {/* Pill — primeiras 3 abas */}
        <View style={[s.pill, { backgroundColor: C.navDark }]}>
          {[0, 1, 2].map(i => {
            const p = getProps(i);
            return (
              <PillItem
                key={p.key}
                label={p.label}
                icon={p.icon}
                isFocused={p.isFocused}
                onPress={p.onPress}
                onLongPress={p.onLongPress}
                C={C}
              />
            );
          })}
        </View>

        {/* Botão protruso — abre Quick Actions */}
        <ActionButton onPress={onActionPress} C={C} />
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flex: 1,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: OVERLAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  pillItem: {
    flex: 1,
  },
  pillPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    height: PILL_H,
  },
  iconWrapper: {
    width: CIRCLE_D,
    height: CIRCLE_D,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: CIRCLE_D,
    height: CIRCLE_D,
    borderRadius: CIRCLE_D / 2,
  },
  actionWrapper: {
    marginLeft: -OVERLAP,
    zIndex: 10,
  },
  actionButton: {
    width: ACTION_D,
    height: ACTION_D,
    borderRadius: ACTION_D / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER_W,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 24,
  },
});
