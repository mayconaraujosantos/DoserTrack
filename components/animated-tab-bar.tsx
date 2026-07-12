'use no memo';

import { Feather, MaterialCommunityIcons, Octicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Animated,
  Appearance,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

const BTN_D = 60;
const CAPSULE_PAD = 10;
const CAPSULE_GAP = 15;
const WRAPPER_H_PADDING = 20;
// bridgeWrap tem width 16 e marginHorizontal -3.5 de cada lado (16 - 7 = 9).
const BRIDGE_NET_WIDTH = 9;
// toque minimo acessivel (~44dp) abaixo do qual preferimos nao encolher mais.
const MIN_BTN_D = 44;
const ACTIVE_BG = '#E3E4E9';
const INACTIVE_BG = '#29377D';
const NAV_DARK = '#111e4f';

type ActiveTab = 'home' | 'meds' | 'calendar' | 'schedules' | 'scan';

// Ordem em que os botões aparecem na cápsula da navbar.
const VISIBLE_TAB_ROUTES = ['index', 'medicines', 'schedule', 'schedules-list'];

/**
 * Calcula o fator de escala pra cápsula (botões + gaps + padding) caber na
 * largura da tela. Telas estreitas (ex.: Galaxy A03, ~384dp) nao comportam
 * o tamanho padrao com 4 botoes visiveis + botao de acoes.
 */
function computeScale(windowWidth: number, buttonCount: number): number {
  const capsuleGroupWidth = buttonCount * BTN_D + (buttonCount - 1) * CAPSULE_GAP + 2 * CAPSULE_PAD;
  const singleCapsuleWidth = BTN_D + 2 * CAPSULE_PAD;
  const fullContentWidth = capsuleGroupWidth + BRIDGE_NET_WIDTH + singleCapsuleWidth;
  const availableWidth = windowWidth - 2 * WRAPPER_H_PADDING;

  if (fullContentWidth <= availableWidth) return 1;

  const scale = availableWidth / fullContentWidth;
  const minScale = MIN_BTN_D / BTN_D;
  return Math.max(scale, minScale);
}

type TabButtonProps = Readonly<{
  label: string;
  activeTab: Exclude<ActiveTab, 'scan'>;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  btnSize: number;
  iconSize: number;
}>;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function renderTabIcon(activeTab: ActiveTab, isFocused: boolean, size: number) {
  const color = isFocused ? '#000000' : '#FFFFFF';

  if (activeTab === 'home') {
    return <Octicons name="home" size={size} color={color} />;
  }

  if (activeTab === 'meds') {
    return <MaterialCommunityIcons name="pill" size={size + 2} color={color} />;
  }

  if (activeTab === 'calendar') {
    return <MaterialCommunityIcons name="calendar-month-outline" size={size + 2} color={color} />;
  }

  if (activeTab === 'schedules') {
    return <MaterialCommunityIcons name="alarm-multiple" size={size + 2} color={color} />;
  }

  return <Feather name="maximize" size={size} color={color} />;
}

function TabButton({
  label,
  activeTab,
  isFocused,
  onPress,
  onLongPress,
  btnSize,
  iconSize,
}: TabButtonProps) {
  const transition = React.useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(transition, {
      toValue: isFocused ? 1 : 0,
      stiffness: 185,
      damping: 14,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [isFocused, transition]);

  const handlePressIn = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const animatedStyle = {
    transform: [
      {
        scale: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05],
        }),
      },
    ],
    backgroundColor: transition.interpolate({
      inputRange: [0, 1],
      outputRange: [INACTIVE_BG, ACTIVE_BG],
    }),
  };

  return (
    <AnimatedTouchable
      style={[
        styles.button,
        { width: btnSize, height: btnSize, borderRadius: btnSize / 2 },
        animatedStyle,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      {renderTabIcon(activeTab, isFocused, iconSize)}
    </AnimatedTouchable>
  );
}

type ActionButtonProps = Readonly<{
  onPress: () => void;
  btnSize: number;
  iconSize: number;
}>;

function ActionButton({ onPress, btnSize, iconSize }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, { width: btnSize, height: btnSize, borderRadius: btnSize / 2 }]}
      onPress={onPress}
      onPressIn={() => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Acoes rapidas"
    >
      <Feather name="maximize" size={iconSize} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function BridgeConnector({ scale }: Readonly<{ scale: number }>) {
  return (
    <View
      style={[
        styles.bridgeWrap,
        { width: 16 * scale, height: 16 * scale, marginHorizontal: -3.5 * scale },
      ]}
      pointerEvents="none"
    >
      <View
        style={[styles.bridge, { width: 18 * scale, height: 20 * scale, borderRadius: 7 * scale }]}
      />
    </View>
  );
}

export type AnimatedTabBarProps = BottomTabBarProps;

type AnimatedTabBarExtraProps = Readonly<{
  onOpenActions: () => void;
}>;

export function AnimatedTabBar(props: Readonly<AnimatedTabBarProps & AnimatedTabBarExtraProps>) {
  const { state, descriptors, navigation, insets } = props;
  const scheme = Appearance.getColorScheme();
  const wrapperBg = scheme === 'dark' ? '#0b1024' : '#eef0f7';
  const { width: windowWidth } = useWindowDimensions();
  const scale = computeScale(windowWidth, VISIBLE_TAB_ROUTES.length);
  const btnSize = BTN_D * scale;
  const iconSize = 24 * scale;
  const capsulePad = CAPSULE_PAD * scale;
  const capsuleGap = CAPSULE_GAP * scale;

  const routeToActiveTab = (routeName: string): Exclude<ActiveTab, 'scan'> => {
    if (routeName === 'medicines') return 'meds';
    if (routeName === 'schedule') return 'calendar';
    if (routeName === 'schedules-list') return 'schedules';
    return 'home';
  };

  const getTabProps = (routeName: string) => {
    const index = state.routes.findIndex(r => r.name === routeName);
    const route = state.routes[index];
    const options = descriptors[route.key].options;
    const label = (options.tabBarLabel as string | undefined) ?? options.title ?? route.name;
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    return {
      key: route.key,
      activeTab: routeToActiveTab(route.name),
      label,
      isFocused,
      onPress,
      onLongPress,
    };
  };

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: wrapperBg, paddingBottom: Math.max(insets.bottom + 12, 24) },
      ]}
    >
      <View style={styles.shadowContainer}>
        <View style={styles.container}>
          <View style={[styles.capsuleGroup, { padding: capsulePad, gap: capsuleGap }]}>
            {VISIBLE_TAB_ROUTES.map(routeName => {
              const tab = getTabProps(routeName);
              return (
                <TabButton
                  key={tab.key}
                  label={tab.label}
                  activeTab={tab.activeTab}
                  isFocused={tab.isFocused}
                  onPress={tab.onPress}
                  onLongPress={tab.onLongPress}
                  btnSize={btnSize}
                  iconSize={iconSize}
                />
              );
            })}
          </View>

          <BridgeConnector scale={scale} />

          <View style={[styles.singleCapsule, { padding: capsulePad }]}>
            <ActionButton onPress={props.onOpenActions} btnSize={btnSize} iconSize={iconSize} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  shadowContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
  },
  capsuleGroup: {
    flexDirection: 'row',
    backgroundColor: NAV_DARK,
    borderRadius: 50,
    overflow: 'hidden',
  },
  singleCapsule: {
    backgroundColor: NAV_DARK,
    borderRadius: 50,
  },
  bridgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bridge: {
    backgroundColor: NAV_DARK,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: INACTIVE_BG,
    zIndex: 2,
  },
});
