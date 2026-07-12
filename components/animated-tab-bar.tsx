'use no memo';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Animated,
  Appearance,
  Image,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Icones extraidos de modelo_exemplo.png (traco branco com alpha), coloridos
// via tintColor conforme o estado selecionado/nao selecionado do botao.
const TAB_ICON_SOURCES = {
  home: require('@/assets/images/tab-icons/home.png'),
  meds: require('@/assets/images/tab-icons/medicines.png'),
  calendar: require('@/assets/images/tab-icons/schedule.png'),
  scan: require('@/assets/images/tab-icons/scan.png'),
} as const;

const BTN_D = 60;
const CAPSULE_PAD = 10;
const CAPSULE_GAP = 15;
const WRAPPER_H_PADDING = 20;
// toque minimo acessivel (~44dp) abaixo do qual preferimos nao encolher mais.
const MIN_BTN_D = 44;
const ACTIVE_BG = '#E3E4E9';
const INACTIVE_BG = '#29377D';
const NAV_DARK = '#111e4f';

// Perfil (dx/R, meia-altura/R) medido pixel a pixel em modelo_exemplo.png,
// do centro da cintura (dx=0) até o raio pleno da cápsula (dx≈1.159R). R é o
// raio da ponta arredondada da cápsula (altura da cápsula / 2).
const BRIDGE_PROFILE: readonly (readonly [number, number])[] = [
  [0, 0.164],
  [0.072, 0.176],
  [0.145, 0.215],
  [0.217, 0.304],
  [0.29, 0.466],
  [0.362, 0.587],
  [0.435, 0.674],
  [0.507, 0.747],
  [0.58, 0.804],
  [0.652, 0.855],
  [0.725, 0.894],
  [0.797, 0.928],
  [0.87, 0.954],
  [0.942, 0.973],
  [1.014, 0.988],
  [1.087, 0.995],
  [1.159, 1.0],
];
const BRIDGE_HALF_SPAN_RATIO = BRIDGE_PROFILE.at(-1)![0];

function catmullRomControlPoints(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number]
) {
  return {
    c1x: p1[0] + (p2[0] - p0[0]) / 6,
    c1y: p1[1] + (p2[1] - p0[1]) / 6,
    c2x: p2[0] - (p3[0] - p1[0]) / 6,
    c2y: p2[1] - (p3[1] - p1[1]) / 6,
  };
}

// toFixed evita notacao cientifica (ex.: "1e-15" de erro de ponto flutuante
// perto de zero), que o parser nativo do svg (horcrux) nao entende.
function fmt(n: number): string {
  return n.toFixed(3);
}

function pathThroughPoints(points: (readonly [number, number])[]): string {
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const { c1x, c1y, c2x, c2y } = catmullRomControlPoints(p0, p1, p2, p3);
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

/** Path SVG fechado (topo + baixo espelhado) da ponte metaball, para uma cápsula de altura 2R. */
function buildBridgePath(R: number): { d: string; width: number; height: number } {
  const height = R * 2;
  const halfSpan = BRIDGE_HALF_SPAN_RATIO * R;
  const width = halfSpan * 2;

  const left = [...BRIDGE_PROFILE]
    .reverse()
    .map(([dxN, hN]) => [halfSpan - dxN * R, R - hN * R] as const);
  const right = BRIDGE_PROFILE.slice(1).map(
    ([dxN, hN]) => [halfSpan + dxN * R, R - hN * R] as const
  );
  const top = [...left, ...right];
  const bottom = [...top].reverse().map(([x, y]) => [x, height - y] as const);

  const topD = pathThroughPoints(top);
  // Remove o "M x y" inicial do path de baixo -- a reta vertical explícita
  // abaixo já leva a caneta até esse mesmo ponto (borda direita, plena altura).
  const bottomD = pathThroughPoints(bottom).replace(/^M [\d.-]+ [\d.-]+ /, '');

  return {
    d: `${topD} L ${fmt(bottom[0][0])} ${fmt(bottom[0][1])} ${bottomD} Z`,
    width,
    height,
  };
}

type ActiveTab = 'home' | 'meds' | 'calendar' | 'schedules' | 'scan';

// Ordem em que os botões aparecem na cápsula da navbar.
const VISIBLE_TAB_ROUTES = ['index', 'medicines', 'schedule', 'schedules-list'];

/**
 * Calcula o fator de escala pra cápsula (botões + gaps + padding) caber na
 * largura da tela. Telas estreitas (ex.: Galaxy A03, ~384dp) nao comportam
 * o tamanho padrao com 4 botoes visiveis + botao de acoes.
 */
function computeScale(windowWidth: number, buttonCount: number): number {
  const capsuleHeight = BTN_D + 2 * CAPSULE_PAD;
  // A ponte se sobrepõe a metade (R) de cada cápsula vizinha (escondida atrás
  // delas); só a parte além disso conta pra largura da linha.
  const bridgeNetWidth = capsuleHeight * (BRIDGE_HALF_SPAN_RATIO - 1);
  const capsuleGroupWidth = buttonCount * BTN_D + (buttonCount - 1) * CAPSULE_GAP + 2 * CAPSULE_PAD;
  const singleCapsuleWidth = BTN_D + 2 * CAPSULE_PAD;
  const fullContentWidth = capsuleGroupWidth + bridgeNetWidth + singleCapsuleWidth;
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

  // "schedules" nao existe em modelo_exemplo.png (botao adicionado depois) --
  // continua vetorial ate ter um icone no mesmo estilo dos demais.
  if (activeTab === 'schedules') {
    return <MaterialCommunityIcons name="alarm-multiple" size={size + 2} color={color} />;
  }

  const source = TAB_ICON_SOURCES[activeTab];

  return (
    <Image
      source={source}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
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
      <Image
        source={TAB_ICON_SOURCES.scan}
        style={{ width: iconSize, height: iconSize, tintColor: '#FFFFFF' }}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

type BridgeConnectorProps = Readonly<{
  height: number;
}>;

/**
 * Ponte entre as duas cápsulas, com a curva metaball medida pixel a pixel em
 * modelo_exemplo.png (BRIDGE_PROFILE). Se sobrepõe a metade de cada cápsula
 * vizinha (a parte do path com altura cheia) -- por isso capsuleGroup e
 * singleCapsule precisam de zIndex maior, pra pintar por cima e esconder a
 * sobreposição, deixando visível só a cintura fina entre elas.
 */
function BridgeConnector({ height }: BridgeConnectorProps) {
  const R = height / 2;
  const { d, width } = buildBridgePath(R);

  return (
    <Svg width={width} height={height} style={{ marginHorizontal: -R }} pointerEvents="none">
      <Path d={d} fill={NAV_DARK} />
    </Svg>
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

          <BridgeConnector height={btnSize + 2 * capsulePad} />

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
    zIndex: 1,
  },
  singleCapsule: {
    backgroundColor: NAV_DARK,
    borderRadius: 50,
    zIndex: 1,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: INACTIVE_BG,
    zIndex: 2,
  },
});
