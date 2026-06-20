import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { markOnboardingDone } from '@/lib/storage';
import { useTheme } from '@/hooks/use-theme';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    key: 'welcome',
    icon: 'medical' as const,
    title: 'Bem-vindo ao Doser',
    subtitle: 'Seu assistente pessoal para nunca esquecer um remédio.',
  },
  {
    key: 'scan',
    icon: 'scan-outline' as const,
    title: 'Escaneie sua receita',
    subtitle:
      'Fotografe a receita médica e o Doser preenche os medicamentos automaticamente com IA.',
  },
  {
    key: 'medicines',
    icon: 'medkit-outline' as const,
    title: 'Controle seu estoque',
    subtitle: 'Acompanhe a quantidade de cada medicamento e receba alertas antes de acabar.',
  },
  {
    key: 'schedule',
    icon: 'alarm-outline' as const,
    title: 'Nunca esqueça uma dose',
    subtitle: 'Defina a frequência — diária, intervalos ou ciclos. O Doser notifica na hora certa.',
  },
] as const;

export default function OnboardingScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  const [current, setCurrent] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Splash screen: 1.5s → fade out
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 1500);
    return () => clearTimeout(timer);
  }, [splashOpacity]);

  async function finishOnboarding(destination: '/login' | '/register') {
    await markOnboardingDone();
    router.replace(destination);
  }

  function goToSlide(index: number) {
    listRef.current?.scrollToIndex({ index, animated: true });
    setCurrent(index);
  }

  function handleNext() {
    if (current < SLIDES.length - 1) {
      goToSlide(current + 1);
    }
  }

  function handlePrev() {
    if (current > 0) {
      goToSlide(current - 1);
    }
  }

  function handleSkip() {
    goToSlide(SLIDES.length - 1);
  }

  function renderSlide({ item }: ListRenderItemInfo<(typeof SLIDES)[number]>) {
    return (
      <View style={[styles.slide, { width: W }]}>
        <View style={[styles.iconCircle, { backgroundColor: C.primary + '18' }]}>
          <Ionicons name={item.icon} size={72} color={C.primary} />
        </View>
        <Text style={[styles.slideTitle, { color: C.text }]}>{item.title}</Text>
        <Text style={[styles.slideSubtitle, { color: C.sub }]}>{item.subtitle}</Text>
      </View>
    );
  }

  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      {/* Splash */}
      {showSplash && (
        <Animated.View
          style={[styles.splash, { backgroundColor: C.primary, opacity: splashOpacity }]}
        >
          <View style={styles.splashLogoWrap}>
            <Ionicons name="medical" size={64} color="#fff" />
          </View>
          <Text style={styles.splashName}>Doser</Text>
        </Animated.View>
      )}

      {!showSplash && (
        <>
          {/* Botão Skip */}
          {!isLast && (
            <TouchableOpacity
              style={[styles.skipBtn, { top: insets.top + 16 }]}
              onPress={handleSkip}
            >
              <Text style={[styles.skipText, { color: C.sub }]}>Pular</Text>
            </TouchableOpacity>
          )}

          {/* Slides */}
          <FlatList
            ref={listRef}
            data={SLIDES}
            renderItem={renderSlide}
            keyExtractor={s => s.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={styles.list}
            getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
            onScrollToIndexFailed={() => {}}
          />

          {/* Navegação */}
          <View style={[styles.nav, { paddingBottom: insets.bottom + 24 }]}>
            {isLast ? (
              /* Último slide: dois botões */
              <View style={styles.lastActions}>
                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: C.primary }]}
                  onPress={() => finishOnboarding('/register')}
                >
                  <Text style={styles.btnPrimaryText}>Criar conta</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnOutline, { borderColor: C.primary }]}
                  onPress={() => finishOnboarding('/login')}
                >
                  <Text style={[styles.btnOutlineText, { color: C.primary }]}>Já tenho conta</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Slides intermediários: ← dots → */
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[
                    styles.navCircle,
                    { backgroundColor: C.card, borderColor: C.border },
                    current === 0 && styles.navCircleHidden,
                  ]}
                  onPress={handlePrev}
                  disabled={current === 0}
                  accessibilityLabel="Anterior"
                >
                  <Ionicons name="arrow-back" size={20} color={C.text} />
                </TouchableOpacity>

                <View style={styles.dotsCenter}>
                  {SLIDES.map((s, i) => (
                    <View
                      key={s.key}
                      style={[
                        styles.dotSm,
                        { backgroundColor: i === current ? C.primary : C.border },
                        i === current && styles.dotSmActive,
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.navCircle, { backgroundColor: C.primary }]}
                  onPress={handleNext}
                  accessibilityLabel="Próximo"
                >
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Splash
  splash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 10,
  },
  splashLogoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },

  // Slides
  list: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
  },
  slideSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Skip
  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 5,
  },
  skipText: { fontSize: 14, fontWeight: '600' },

  // Nav row
  nav: { paddingHorizontal: 28 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCircleHidden: { opacity: 0 },
  dotsCenter: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dotSm: { width: 8, height: 8, borderRadius: 4 },
  dotSmActive: { width: 20 },

  // Last slide actions
  lastActions: { gap: 12 },
  btnPrimary: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontSize: 16, fontWeight: '700' },
});
