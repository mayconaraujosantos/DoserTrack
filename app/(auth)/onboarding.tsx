import { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { markOnboardingDone } from '@/lib/storage';
import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/components/ui/Text';

const { width: W } = Dimensions.get('window');

// ─── Slides ───────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'welcome',
    icon: 'medical' as const,
    color: '#5D54FF',
    title: 'Bem-vindo ao DoserTrack',
    subtitle: 'Seu assistente pessoal para nunca esquecer um remédio.',
  },
  {
    key: 'scan',
    icon: 'scan-outline' as const,
    color: '#00B4D8',
    title: 'Escaneie sua receita',
    subtitle: 'Fotografe a receita médica e preenchemos os medicamentos automaticamente com IA.',
  },
  {
    key: 'medicines',
    icon: 'medkit-outline' as const,
    color: '#06D6A0',
    title: 'Controle seu estoque',
    subtitle: 'Acompanhe a quantidade de cada remédio e receba alertas antes de acabar.',
  },
  {
    key: 'schedule',
    icon: 'alarm-outline' as const,
    color: '#FF6B6B',
    title: 'Nunca perca uma dose',
    subtitle: 'Defina frequência e horário. O DoserTrack notifica na hora certa.',
  },
] as const;

type Slide = (typeof SLIDES)[number];

// Valores para interpolateColor devem ser literais acessíveis na worklet
const SLIDE_COLORS = SLIDES.map(s => s.color);
const SLIDE_BG_TINTS = SLIDES.map(s => s.color + '12');
const SLIDE_OFFSETS = SLIDES.map((_, i) => i * W);

// ─── PaginationDot ────────────────────────────────────────────────────────────

function PaginationDot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const width = interpolate(scrollX.value, inputRange, [8, 28, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP);
    const backgroundColor = interpolateColor(scrollX.value, SLIDE_OFFSETS, SLIDE_COLORS);
    return { width, opacity, backgroundColor };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

// ─── SlideItem ────────────────────────────────────────────────────────────────

function SlideItem({
  item,
  index,
  scrollX,
}: {
  item: Slide;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const C = useTheme();

  const iconStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const scale = interpolate(scrollX.value, inputRange, [0.6, 1, 0.6], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  const textStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
    const translateY = interpolate(scrollX.value, inputRange, [48, 0, -32], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
    return { transform: [{ translateY }], opacity };
  });

  return (
    <View style={[styles.slide, { width: W }]}>
      {/* Illustration */}
      <Animated.View style={[styles.illustrationWrap, iconStyle]}>
        <View style={[styles.iconRingOuter, { backgroundColor: item.color + '12' }]}>
          <View style={[styles.iconRingInner, { backgroundColor: item.color + '22' }]}>
            <Ionicons name={item.icon} size={68} color={item.color} />
          </View>
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text
          style={[styles.slideTitle, { color: C.text }]}
          maxFontSizeMultiplier={1.2}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {item.title}
        </Text>
        <Text style={[styles.slideSubtitle, { color: C.sub }]} maxFontSizeMultiplier={1.2}>
          {item.subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── OnboardingScreen ─────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x;
  });

  const isLast = currentIndex === SLIDES.length - 1;
  const activeColor = SLIDES[currentIndex]?.color ?? C.primary;

  function goTo(index: number) {
    listRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  }

  async function finish(destination: '/login' | '/register') {
    await markOnboardingDone();
    router.replace(destination);
  }

  const renderSlide = useCallback(
    ({ item, index }: { item: Slide; index: number }) => (
      <SlideItem item={item} index={index} scrollX={scrollX} />
    ),
    [scrollX]
  );

  // Background animado
  const bgStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(scrollX.value, SLIDE_OFFSETS, SLIDE_BG_TINTS);
    return { backgroundColor };
  });

  // Nav row (não-último slide): fade out ao chegar no último
  const navRowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(SLIDES.length - 2) * W, (SLIDES.length - 1) * W],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Last actions: fade in no último slide
  const lastActionsStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(SLIDES.length - 2) * W, (SLIDES.length - 1) * W],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <Animated.View style={[styles.root, { backgroundColor: C.bg }, bgStyle]}>
      {/* Skip */}
      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 14, opacity: isLast ? 0 : 1 }]}
        onPress={() => goTo(SLIDES.length - 1)}
        disabled={isLast}
        accessibilityLabel="Pular apresentação"
      >
        <Text style={[styles.skipText, { color: C.sub }]}>Pular</Text>
      </TouchableOpacity>

      {/* Slides */}
      <Animated.FlatList
        ref={listRef as never}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / W);
          setCurrentIndex(idx);
        }}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        style={styles.list}
      />

      {/* Bottom */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <PaginationDot key={i} index={i} scrollX={scrollX} />
          ))}
        </View>

        {/* CTA area — ambos sempre renderizados, opacidade animada */}
        <View style={styles.ctaWrap}>
          {/* Nav row: voltar + próximo */}
          <Animated.View
            style={[styles.navRow, navRowStyle]}
            pointerEvents={isLast ? 'none' : 'auto'}
          >
            <TouchableOpacity
              style={[
                styles.circleBtn,
                { backgroundColor: C.card, borderColor: C.border },
                currentIndex === 0 && styles.invisible,
              ]}
              onPress={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              accessibilityLabel="Slide anterior"
            >
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.circleBtn, styles.circleBtnNext, { backgroundColor: activeColor }]}
              onPress={() => goTo(currentIndex + 1)}
              accessibilityLabel="Próximo slide"
            >
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
          </Animated.View>

          {/* Last slide: criar conta + login */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.lastActions, lastActionsStyle]}
            pointerEvents={isLast ? 'auto' : 'none'}
          >
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: activeColor }]}
              onPress={() => finish('/register')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Criar conta grátis</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: activeColor }]}
              onPress={() => finish('/login')}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnOutlineText, { color: activeColor }]}>Já tenho conta</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },

  // Skip
  skipBtn: { position: 'absolute', right: 24, zIndex: 10 },
  skipText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // Slide
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 32,
  },

  // Icon illustration
  illustrationWrap: { alignItems: 'center', justifyContent: 'center' },
  iconRingOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text block
  textBlock: { alignItems: 'center', gap: 12 },
  slideTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  slideSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '400',
  },

  // Bottom
  bottom: { paddingHorizontal: 28, gap: 28 },

  // Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },

  // CTA wrap
  ctaWrap: { height: 120, justifyContent: 'center' },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnNext: { borderWidth: 0, width: 60, height: 60, borderRadius: 30 },
  invisible: { opacity: 0 },

  // Last actions
  lastActions: {
    gap: 12,
    justifyContent: 'center',
  },
  btnPrimary: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontSize: 16, fontWeight: '700' },
});
