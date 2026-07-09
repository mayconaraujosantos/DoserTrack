import { useMedicines } from '@/hooks/use-medicines';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SPRING = { damping: 26, stiffness: 280, mass: 0.9 };

type Props = { visible: boolean; onClose: () => void };

type ActionItem = {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  route: string;
  color: string;
};

type SheetMode = 'actions' | 'schedule-prerequisite';

export function QuickActionsSheet({ visible, onClose }: Readonly<Props>) {
  const C = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Mantemos o modal montado enquanto anima para fora
  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState<SheetMode>('actions');
  const translateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      setMode('actions');
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, SPRING);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(500, SPRING, () => {
        runOnJS(setModalVisible)(false);
      });
    }
  }, [visible, backdropOpacity, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const { data: medicines = [] } = useMedicines();

  const navigate = useCallback(
    (route: string) => {
      onClose();
      router.push(route as never);
    },
    [onClose, router]
  );

  const openSchedulePrerequisite = useCallback(() => {
    setMode('schedule-prerequisite');
  }, []);

  const actions: ActionItem[] = [
    {
      key: 'scan-med',
      icon: 'scan-outline',
      label: 'Escanear embalagem',
      sub: 'Foto do medicamento',
      route: '/scan-medicine',
      color: C.primary,
    },
    {
      key: 'scan-rx',
      icon: 'document-text-outline',
      label: 'Escanear receita',
      sub: 'Importar do médico',
      route: '/scan-prescription',
      color: C.success,
    },
    {
      key: 'add-med',
      icon: 'add-circle-outline',
      label: 'Novo remédio',
      sub: 'Cadastro manual',
      route: '/add-medicine',
      color: C.warning,
    },
    {
      key: 'add-sched',
      icon: 'alarm-outline',
      label: 'Novo agendamento',
      sub: 'Horário de dose',
      route: '/add-schedule',
      color: C.danger,
    },
  ];

  return (
    <Modal
      transparent
      visible={modalVisible}
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { backgroundColor: C.card, paddingBottom: Math.max(insets.bottom + 16, 28) },
          sheetStyle,
        ]}
      >
        {/* Drag handle */}
        <View style={[s.handle, { backgroundColor: C.border }]} />

        <Text style={[s.title, { color: C.text }]}>
          {mode === 'actions' ? 'Ações Rápidas' : 'Cadastre um medicamento primeiro'}
        </Text>

        {mode === 'actions' ? (
          <>
            <View style={s.grid}>
              {actions.map(action => (
                <Pressable
                  key={action.key}
                  style={({ pressed }) => [
                    s.card,
                    { backgroundColor: action.color + '14', opacity: pressed ? 0.72 : 1 },
                  ]}
                  onPress={() => {
                    if (process.env.EXPO_OS === 'ios') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    if (action.key === 'add-sched' && medicines.length === 0) {
                      openSchedulePrerequisite();
                      return;
                    }
                    navigate(action.route);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <View style={[s.iconCircle, { backgroundColor: action.color + '22' }]}>
                    <Ionicons name={action.icon} size={26} color={action.color} />
                  </View>
                  <Text style={[s.cardLabel, { color: C.text }]} numberOfLines={2}>
                    {action.label}
                  </Text>
                  <Text style={[s.cardSub, { color: C.sub }]} numberOfLines={1}>
                    {action.sub}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={[s.divider, { backgroundColor: C.border }]} />
            <Pressable
              style={({ pressed }) => [s.historyRow, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => navigate('/(app)/(tabs)/history')}
              accessibilityRole="button"
              accessibilityLabel="Ver histórico completo"
            >
              <Ionicons name="bar-chart-outline" size={20} color={C.sub} />
              <Text style={[s.historyText, { color: C.sub }]}>Ver histórico completo</Text>
              <Ionicons name="chevron-forward" size={16} color={C.sub} />
            </Pressable>
          </>
        ) : (
          <View style={s.prereqWrap}>
            <Text style={[s.prereqText, { color: C.sub }]}>
              Para criar um agendamento, você precisa ter pelo menos um medicamento cadastrado.
            </Text>

            <Pressable
              style={({ pressed }) => [
                s.prereqAction,
                { backgroundColor: C.warning + '14', opacity: pressed ? 0.72 : 1 },
              ]}
              onPress={() => navigate('/add-medicine')}
              accessibilityRole="button"
              accessibilityLabel="Cadastrar medicamento manualmente"
            >
              <View style={[s.iconCircle, { backgroundColor: C.warning + '22' }]}>
                <Ionicons name="add-circle-outline" size={24} color={C.warning} />
              </View>
              <View style={s.prereqCopy}>
                <Text style={[s.cardLabel, { color: C.text }]}>Cadastrar manualmente</Text>
                <Text style={[s.cardSub, { color: C.sub }]}>Adicionar nome, dose e estoque</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                s.prereqAction,
                { backgroundColor: C.primary + '14', opacity: pressed ? 0.72 : 1 },
              ]}
              onPress={() => navigate('/scan-medicine')}
              accessibilityRole="button"
              accessibilityLabel="Escanear embalagem do medicamento"
            >
              <View style={[s.iconCircle, { backgroundColor: C.primary + '22' }]}>
                <Ionicons name="scan-outline" size={24} color={C.primary} />
              </View>
              <View style={s.prereqCopy}>
                <Text style={[s.cardLabel, { color: C.text }]}>Escanear embalagem</Text>
                <Text style={[s.cardSub, { color: C.sub }]}>
                  Cadastrar mais rápido com a câmera
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.backRow, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => setMode('actions')}
              accessibilityRole="button"
              accessibilityLabel="Voltar para ações rápidas"
            >
              <Ionicons name="chevron-back" size={16} color={C.sub} />
              <Text style={[s.historyText, { color: C.sub }]}>Voltar</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            s.cancelBtn,
            { backgroundColor: C.bg, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={[s.cancelText, { color: C.sub }]}>Cancelar</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    width: '47.5%',
    borderRadius: 20,
    padding: 16,
    gap: 8,
    minHeight: 118,
    justifyContent: 'flex-end',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  historyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  prereqWrap: {
    gap: 12,
    marginBottom: 16,
  },
  prereqText: {
    fontSize: 13,
    lineHeight: 19,
  },
  prereqAction: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prereqCopy: {
    flex: 1,
    gap: 2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  cancelBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
