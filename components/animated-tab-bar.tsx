import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

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

function PillItem({ label, icon, isFocused, onPress, onLongPress, C }: Readonly<PillItemProps>) {
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
  onScanMedicine: () => void;
  onScanPrescription: () => void;
  onAddMedicine: () => void;
  onAddSchedule: () => void;
  C: ThemeColors;
};

type ActionMenuItem = {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
};

function ActionButton({
  onScanMedicine,
  onScanPrescription,
  onAddMedicine,
  onAddSchedule,
  C,
}: Readonly<ActionButtonProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const pressScale = useSharedValue(1);
  const menuProgress = useSharedValue(0);

  const actions = useMemo<ActionMenuItem[]>(
    () => [
      {
        key: 'scan-med',
        icon: 'scan-outline',
        label: 'Escanear embalagem',
        onPress: onScanMedicine,
      },
      {
        key: 'scan-rx',
        icon: 'document-text-outline',
        label: 'Escanear receita',
        onPress: onScanPrescription,
      },
      {
        key: 'add-med',
        icon: 'add-circle-outline',
        label: 'Novo remédio',
        onPress: onAddMedicine,
      },
      {
        key: 'add-sched',
        icon: 'alarm-outline',
        label: 'Novo agendamento',
        onPress: onAddSchedule,
      },
    ],
    [onAddMedicine, onAddSchedule, onScanMedicine, onScanPrescription]
  );

  useEffect(() => {
    menuProgress.value = withTiming(isOpen ? 1 : 0, { duration: 220 });
  }, [isOpen, menuProgress]);

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

  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
    transform: [{ translateY: (1 - menuProgress.value) * 10 }],
  }));

  const onMainPress = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const onActionPress = useCallback((handler: () => void) => {
    setIsOpen(false);
    handler();
  }, []);

  return (
    <Animated.View style={[s.actionWrapper, itemStyle]}>
      {isOpen && (
        <Animated.View
          style={[s.actionMenu, { backgroundColor: C.card, borderColor: C.border }, menuStyle]}
        >
          {actions.map(action => (
            <Pressable
              key={action.key}
              onPress={() => onActionPress(action.onPress)}
              style={({ pressed }) => [s.actionMenuItem, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Ionicons name={action.icon} size={18} color={C.primary} />
              <View style={s.actionMenuLabelWrap}>
                <Animated.Text style={[s.actionMenuLabel, { color: C.text }]}>
                  {action.label}
                </Animated.Text>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      )}

      <Pressable
        onPress={onMainPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[s.actionButton, { backgroundColor: C.navAction, borderColor: C.bg }]}
        accessibilityRole="button"
        accessibilityLabel="Adicionar ou escanear"
        accessibilityHint="Toque para abrir ações rápidas"
      >
        <Ionicons name={isOpen ? 'close' : 'add'} size={26} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

// ── Tab bar principal ────────────────────────────────────────────────────────

export type AnimatedTabBarProps = BottomTabBarProps & {
  onScanMedicine: () => void;
  onScanPrescription: () => void;
  onAddMedicine: () => void;
  onAddSchedule: () => void;
};

export function AnimatedTabBar({
  state,
  descriptors,
  navigation,
  insets,
  onScanMedicine,
  onScanPrescription,
  onAddMedicine,
  onAddSchedule,
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

        {/* Botão protruso — menu de ações sem modal */}
        <ActionButton
          onScanMedicine={onScanMedicine}
          onScanPrescription={onScanPrescription}
          onAddMedicine={onAddMedicine}
          onAddSchedule={onAddSchedule}
          C={C}
        />
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
  actionMenu: {
    position: 'absolute',
    right: 4,
    bottom: ACTION_D + 10,
    minWidth: 210,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 12,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  actionMenuLabelWrap: {
    flex: 1,
  },
  actionMenuLabel: {
    fontSize: 13,
    fontWeight: '600',
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
