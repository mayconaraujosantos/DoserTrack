import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Dimensions, type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { markOnboardingDone } from '@/lib/storage';
import { useTheme } from '@/hooks/use-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    subtitle: 'Fotografe a receita médica e o Doser preenche os medicamentos automaticamente com IA.',
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

  async function handleFinish() {
    await markOnboardingDone();
    router.replace('/(tabs)' as never);
  }

  function handleNext() {
    if (current < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true });
      setCurrent(current + 1);
    } else {
      handleFinish();
    }
  }

  function renderSlide({ item }: ListRenderItemInfo<typeof SLIDES[number]>) {
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View style={[styles.iconCircle, { backgroundColor: C.primary + '18' }]}>
          <Ionicons name={item.icon} size={64} color={C.primary} />
        </View>
        <Text style={[styles.title, { color: C.text }]}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: C.sub }]}>{item.subtitle}</Text>
      </View>
    );
  }

  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: C.bg, paddingBottom: insets.bottom + 24 }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.list}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              { backgroundColor: i === current ? C.primary : C.border },
              i === current && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: C.primary }]}
        onPress={handleNext}
      >
        <Text style={styles.btnText}>
          {isLast ? 'Começar' : 'Próximo'}
        </Text>
        <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color="#fff" />
      </TouchableOpacity>

      {!isLast && (
        <TouchableOpacity onPress={handleFinish} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: C.sub }]}>Pular</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 20,
  },
  iconCircle: {
    width: 128, height: 128, borderRadius: 64,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 24, height: 54, borderRadius: 16,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', marginTop: 12 },
  skipText: { fontSize: 14 },
});
