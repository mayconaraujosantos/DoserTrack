'use no memo';

import { Feather, MaterialCommunityIcons, Octicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Animated, Appearance, StyleSheet, TouchableOpacity, View } from 'react-native';

const BTN_D = 60;
const CAPSULE_PAD = 10;
const CAPSULE_GAP = 15;
const ACTIVE_BG = '#E3E4E9';
const INACTIVE_BG = '#29377D';
const NAV_DARK = '#111e4f';

type ActiveTab = 'home' | 'meds' | 'calendar' | 'scan';

type TabButtonProps = Readonly<{
  label: string;
  activeTab: Exclude<ActiveTab, 'scan'>;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}>;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function renderTabIcon(activeTab: ActiveTab, isFocused: boolean) {
  const color = isFocused ? '#000000' : '#FFFFFF';
  const size = 24;

  if (activeTab === 'home') {
    return <Octicons name="home" size={size} color={color} />;
  }

  if (activeTab === 'meds') {
    return <MaterialCommunityIcons name="pill" size={size + 2} color={color} />;
  }

  if (activeTab === 'calendar') {
    return <MaterialCommunityIcons name="calendar-month-outline" size={size + 2} color={color} />;
  }

  return <Feather name="maximize" size={size} color={color} />;
}

function TabButton({ label, activeTab, isFocused, onPress, onLongPress }: TabButtonProps) {
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
      style={[styles.button, animatedStyle]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      {renderTabIcon(activeTab, isFocused)}
    </AnimatedTouchable>
  );
}

type ActionButtonProps = Readonly<{
  onPress: () => void;
}>;

function ActionButton({ onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
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
      <Feather name="maximize" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function BridgeConnector() {
  return (
    <View style={styles.bridgeWrap} pointerEvents="none">
      <View style={styles.bridge} />
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

  const routeToActiveTab = (routeName: string): Exclude<ActiveTab, 'scan'> => {
    if (routeName === 'medicines') return 'meds';
    if (routeName === 'schedule') return 'calendar';
    return 'home';
  };

  const getTabProps = (index: number) => {
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
          <View style={styles.tripleCapsule}>
            {[0, 1, 2].map(index => {
              const tab = getTabProps(index);
              return (
                <TabButton
                  key={tab.key}
                  label={tab.label}
                  activeTab={tab.activeTab}
                  isFocused={tab.isFocused}
                  onPress={tab.onPress}
                  onLongPress={tab.onLongPress}
                />
              );
            })}
          </View>

          <BridgeConnector />

          <View style={styles.singleCapsule}>
            <ActionButton onPress={props.onOpenActions} />
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
  tripleCapsule: {
    flexDirection: 'row',
    backgroundColor: NAV_DARK,
    borderRadius: 50,
    padding: CAPSULE_PAD,
    gap: CAPSULE_GAP,
    overflow: 'hidden',
  },
  singleCapsule: {
    backgroundColor: NAV_DARK,
    borderRadius: 50,
    padding: CAPSULE_PAD,
  },
  bridgeWrap: {
    width: 16,
    height: 16,
    marginHorizontal: -3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bridge: {
    width: 18,
    height: 20,
    backgroundColor: NAV_DARK,
    borderRadius: 7,
  },
  button: {
    width: BTN_D,
    height: BTN_D,
    borderRadius: BTN_D / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: INACTIVE_BG,
    zIndex: 2,
  },
});
