import { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  createMedicine,
  createSchedule,
  generateDosesForSchedule,
  updateDoseNotificationId,
  getDosesForDate,
} from '@/lib/database';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { notifyLowStock, scheduleDoseNotification } from '@/lib/notifications';
import { syncToCloud } from '@/lib/sync';
import { Text } from '@/components/ui/Text';
import { TimePickerInput } from '@/components/ui/time-picker-input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import type { MedicineType, FrequencyType, FrequencyConfig } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { ThemeColors } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const TOTAL_STEPS = 3;

const MED_TYPES: { value: MedicineType; icon: string; label: string }[] = [
  { value: 'capsule', icon: 'ellipse-outline', label: 'Cápsula' },
  { value: 'tablet', icon: 'square-outline', label: 'Comprimido' },
  { value: 'drop', icon: 'water-outline', label: 'Gota' },
  { value: 'ml', icon: 'flask-outline', label: 'mL' },
  { value: 'injection', icon: 'fitness-outline', label: 'Injeção' },
  { value: 'other', icon: 'medical-outline', label: 'Outro' },
];

const UNITS: Record<MedicineType, string> = {
  capsule: 'cápsulas',
  tablet: 'comprimidos',
  drop: 'gotas',
  ml: 'mL',
  injection: 'ampolas',
  other: 'unidades',
};

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const EASING = Easing.out(Easing.cubic);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── Step Dots ────────────────────────────────────────────────────────────────

function StepDots({ step, C }: { step: number; C: ThemeColors }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            dots.base,
            i === step
              ? [dots.active, { backgroundColor: C.primary }]
              : i < step
                ? [dots.done, { backgroundColor: C.primary + '66' }]
                : [dots.pending, { backgroundColor: C.border }],
          ]}
        />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  base: { height: 6, borderRadius: 3 },
  active: { width: 28 },
  done: { width: 8 },
  pending: { width: 8 },
});

// ─── Wizard Header ────────────────────────────────────────────────────────────

const STEP_TITLES = ['Qual medicamento?', 'Estoque e foto', 'Quando tomar?'];

function WizardHeader({
  step,
  onBack,
  C,
  topInset,
}: {
  step: number;
  onBack: () => void;
  C: ThemeColors;
  topInset: number;
}) {
  return (
    <View style={[wh.container, { paddingTop: topInset + 8, backgroundColor: C.bg }]}>
      <View style={wh.row}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={wh.backBtn}
          accessibilityLabel={step === 0 ? 'Fechar' : 'Voltar'}
        >
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={24} color={C.text} />
        </TouchableOpacity>
        <StepDots step={step} C={C} />
        <View style={wh.side} />
      </View>
      <Text style={[wh.title, { color: C.text }]}>{STEP_TITLES[step]}</Text>
      <Text style={[wh.sub, { color: C.sub }]}>
        Passo {step + 1} de {TOTAL_STEPS}
      </Text>
    </View>
  );
}

const wh = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  side: { width: 36 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 13, fontWeight: '500' },
});

// ─── Step 1: Nome e tipo ──────────────────────────────────────────────────────

function Step1({
  name,
  setName,
  type,
  setType,
  C,
  inputRef,
}: {
  name: string;
  setName: (v: string) => void;
  type: MedicineType;
  setType: (v: MedicineType) => void;
  C: ThemeColors;
  inputRef: React.RefObject<TextInput | null>;
}) {
  return (
    <View style={[s1.container, { width: SCREEN_W }]}>
      <TextInput
        ref={inputRef}
        value={name}
        onChangeText={setName}
        placeholder="Ex: Paracetamol 750mg"
        placeholderTextColor={C.sub}
        autoCapitalize="words"
        returnKeyType="done"
        style={[
          s1.nameInput,
          { color: C.text, borderColor: name ? C.primary : C.border, backgroundColor: C.card },
        ]}
      />

      <Text style={[s1.label, { color: C.sub }]}>FORMA FARMACÊUTICA</Text>

      <View style={s1.grid}>
        {MED_TYPES.map(t => {
          const active = type === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              style={[
                s1.typeBtn,
                {
                  backgroundColor: active ? C.primary : C.card,
                  borderColor: active ? C.primary : C.border,
                },
              ]}
              onPress={() => setType(t.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Ionicons name={t.icon as never} size={22} color={active ? '#fff' : C.sub} />
              <Text style={[s1.typeLbl, { color: active ? '#fff' : C.sub }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s1 = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 20 },
  nameInput: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: -10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: {
    width: '30%',
    aspectRatio: 1.05,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  typeLbl: { fontSize: 11, fontWeight: '700' },
});

// ─── Step 2: Estoque e foto ───────────────────────────────────────────────────

function Step2({
  type,
  stock,
  setStock,
  threshold,
  setThreshold,
  photoUri,
  onPickPhoto,
  C,
}: {
  type: MedicineType;
  stock: string;
  setStock: (v: string) => void;
  threshold: string;
  setThreshold: (v: string) => void;
  photoUri: string | undefined;
  onPickPhoto: () => void;
  C: ThemeColors;
}) {
  return (
    <ScrollView
      style={{ width: SCREEN_W }}
      contentContainerStyle={s2.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Foto */}
      <TouchableOpacity
        style={[s2.photoBtn, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={onPickPhoto}
        activeOpacity={0.8}
        accessibilityLabel="Adicionar foto do medicamento"
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s2.photoImg} />
        ) : (
          <View style={s2.photoPlaceholder}>
            <View style={[s2.photoIcon, { backgroundColor: C.primary + '18' }]}>
              <Ionicons name="camera-outline" size={26} color={C.primary} />
            </View>
            <Text style={[s2.photoLbl, { color: C.sub }]}>Foto do medicamento</Text>
            <Text style={[s2.photoSub, { color: C.sub + 'AA' }]}>opcional</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={s2.field}>
        <Text style={[s2.label, { color: C.sub }]}>QUANTIDADE EM ESTOQUE</Text>
        <View style={[s2.inputRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <TextInput
            value={stock}
            onChangeText={setStock}
            placeholder="0"
            placeholderTextColor={C.sub}
            keyboardType="decimal-pad"
            style={[s2.input, { color: C.text }]}
          />
          <Text style={[s2.unit, { color: C.sub }]}>{UNITS[type]}</Text>
        </View>
      </View>

      <View style={s2.field}>
        <Text style={[s2.label, { color: C.sub }]}>ALERTAR QUANDO RESTAR MENOS DE</Text>
        <View style={[s2.inputRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <TextInput
            value={threshold}
            onChangeText={setThreshold}
            placeholder="5"
            placeholderTextColor={C.sub}
            keyboardType="number-pad"
            style={[s2.input, { color: C.text }]}
          />
          <Text style={[s2.unit, { color: C.sub }]}>{UNITS[type]}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s2 = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 24, paddingBottom: 16 },
  photoBtn: {
    height: 130,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  photoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLbl: { fontSize: 14, fontWeight: '600' },
  photoSub: { fontSize: 12 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    height: 52,
  },
  input: { flex: 1, fontSize: 17, fontWeight: '600' },
  unit: { fontSize: 14, fontWeight: '500' },
});

// ─── Step 3: Horário ──────────────────────────────────────────────────────────

function Step3({
  type,
  freqType,
  setFreqType,
  specificDays,
  toggleDay,
  intervalHours,
  setIntervalHours,
  daysOn,
  setDaysOn,
  daysOff,
  setDaysOff,
  times,
  setTimes,
  startDate,
  setStartDate,
  C,
}: {
  type: MedicineType;
  freqType: FrequencyType;
  setFreqType: (v: FrequencyType) => void;
  specificDays: number[];
  toggleDay: (d: number) => void;
  intervalHours: string;
  setIntervalHours: (v: string) => void;
  daysOn: string;
  setDaysOn: (v: string) => void;
  daysOff: string;
  setDaysOff: (v: string) => void;
  times: string[];
  setTimes: (ts: string[]) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  C: ThemeColors;
}) {
  const [timeInput, setTimeInput] = useState('08:00');

  function addTime() {
    const t = timeInput || '08:00';
    if (!times.includes(t)) setTimes([...times, t].sort((a, b) => a.localeCompare(b)));
  }

  function removeTime(t: string) {
    setTimes(times.filter(x => x !== t));
  }

  return (
    <ScrollView
      style={{ width: SCREEN_W }}
      contentContainerStyle={s3.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Frequência */}
      <View style={s3.section}>
        <Text style={[s3.label, { color: C.sub }]}>FREQUÊNCIA</Text>
        <View style={s3.freqList}>
          {(
            [
              ['specific_days', 'Dias da semana', 'calendar-outline'],
              ['interval_hours', 'A cada X horas', 'timer-outline'],
              ['fixed_cycle', 'Ciclo fixo', 'repeat-outline'],
            ] as [FrequencyType, string, string][]
          ).map(([val, lbl, icon]) => {
            const active = freqType === val;
            return (
              <TouchableOpacity
                key={val}
                style={[
                  s3.freqBtn,
                  {
                    backgroundColor: active ? C.primary + '14' : C.card,
                    borderColor: active ? C.primary : C.border,
                  },
                ]}
                onPress={() => setFreqType(val)}
              >
                <Ionicons name={icon as never} size={18} color={active ? C.primary : C.sub} />
                <Text style={[s3.freqLbl, { color: active ? C.primary : C.text }]}>{lbl}</Text>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={C.primary}
                    style={s3.checkmark}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Config da frequência */}
      {freqType === 'specific_days' && (
        <View style={s3.section}>
          <Text style={[s3.label, { color: C.sub }]}>DIAS DA SEMANA</Text>
          <View style={s3.daysRow}>
            {DAYS_PT.map((d, i) => {
              const active = specificDays.includes(i);
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    s3.dayBtn,
                    {
                      backgroundColor: active ? C.primary : C.card,
                      borderColor: active ? C.primary : C.border,
                    },
                  ]}
                  onPress={() => toggleDay(i)}
                >
                  <Text style={[s3.dayLbl, { color: active ? '#fff' : C.sub }]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {freqType === 'interval_hours' && (
        <View style={s3.section}>
          <Text style={[s3.label, { color: C.sub }]}>INTERVALO</Text>
          <View style={s3.inlineRow}>
            <Text style={[s3.inlineText, { color: C.text }]}>A cada</Text>
            <TextInput
              value={intervalHours}
              onChangeText={setIntervalHours}
              keyboardType="number-pad"
              style={[
                s3.shortInput,
                { color: C.text, borderColor: C.border, backgroundColor: C.card },
              ]}
            />
            <Text style={[s3.inlineText, { color: C.text }]}>horas</Text>
          </View>
        </View>
      )}

      {freqType === 'fixed_cycle' && (
        <View style={s3.section}>
          <Text style={[s3.label, { color: C.sub }]}>CICLO</Text>
          <View style={s3.inlineRow}>
            <TextInput
              value={daysOn}
              onChangeText={setDaysOn}
              keyboardType="number-pad"
              style={[
                s3.shortInput,
                { color: C.text, borderColor: C.border, backgroundColor: C.card },
              ]}
            />
            <Text style={[s3.inlineText, { color: C.text }]}>dias tomando, depois</Text>
            <TextInput
              value={daysOff}
              onChangeText={setDaysOff}
              keyboardType="number-pad"
              style={[
                s3.shortInput,
                { color: C.text, borderColor: C.border, backgroundColor: C.card },
              ]}
            />
            <Text style={[s3.inlineText, { color: C.text }]}>dias de pausa</Text>
          </View>
        </View>
      )}

      {/* Horários */}
      <View style={s3.section}>
        <Text style={[s3.label, { color: C.sub }]}>HORÁRIOS</Text>
        {times.length > 0 && (
          <View style={s3.chips}>
            {times.map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  s3.chip,
                  { backgroundColor: C.primary + '14', borderColor: C.primary + '44' },
                ]}
                onPress={() => removeTime(t)}
              >
                <Ionicons name="time-outline" size={13} color={C.primary} />
                <Text style={[s3.chipText, { color: C.primary }]}>{t}</Text>
                <Ionicons name="close" size={13} color={C.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={s3.addRow}>
          <View style={{ flex: 1 }}>
            <TimePickerInput label="" value={timeInput} onChange={setTimeInput} />
          </View>
          <TouchableOpacity
            style={[s3.addBtn, { backgroundColor: C.primary }]}
            onPress={addTime}
            accessibilityLabel="Adicionar horário"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Data de início */}
      <View style={s3.section}>
        <Text style={[s3.label, { color: C.sub }]}>DATA DE INÍCIO</Text>
        <DatePickerInput label="" value={startDate} onChange={setStartDate} />
      </View>
    </ScrollView>
  );
}

const s3 = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 24, paddingBottom: 16 },
  section: { gap: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  freqList: { gap: 8 },
  freqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  freqLbl: { flex: 1, fontSize: 14, fontWeight: '600' },
  checkmark: { marginLeft: 'auto' },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayLbl: { fontSize: 12, fontWeight: '700' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  inlineText: { fontSize: 14, fontWeight: '500' },
  shortInput: {
    width: 64,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── AddMedicineScreen ────────────────────────────────────────────────────────

export default function AddMedicineScreen() {
  const params = useLocalSearchParams<{
    prefill_name?: string;
    prefill_type?: string;
    prefill_quantity?: string;
  }>();

  const prefillType = params.prefill_type as MedicineType | undefined;
  const validTypes: MedicineType[] = ['capsule', 'tablet', 'drop', 'ml', 'injection', 'other'];
  const resolvedType: MedicineType =
    prefillType && validTypes.includes(prefillType) ? prefillType : 'capsule';

  // ── Step 1 state
  const [name, setName] = useState(params.prefill_name ?? '');
  const [type, setType] = useState<MedicineType>(resolvedType);

  // ── Step 2 state
  const [stock, setStock] = useState(params.prefill_quantity ?? '');
  const [threshold, setThreshold] = useState('5');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  // ── Step 3 state
  const [freqType, setFreqType] = useState<FrequencyType>('specific_days');
  const [specificDays, setSpecificDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [intervalHours, setIntervalHours] = useState('8');
  const [daysOn, setDaysOn] = useState('21');
  const [daysOff, setDaysOff] = useState('7');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [startDate, setStartDate] = useState(todayStr());

  // ── Navigation
  const [step, setStep] = useState(0);
  const stepAnim = useSharedValue(0);

  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const nameInputRef = useRef<TextInput>(null);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -stepAnim.value * SCREEN_W }],
  }));

  function goToStep(next: number) {
    setStep(next);
    stepAnim.value = withTiming(next, { duration: 300, easing: EASING });
  }

  function goBack() {
    if (step === 0) router.back();
    else goToStep(step - 1);
  }

  function goNext() {
    if (step === 0 && !name.trim()) {
      Alert.alert('Nome obrigatório', 'Digite o nome do medicamento.');
      return;
    }
    if (step < TOTAL_STEPS - 1) goToStep(step + 1);
  }

  function toggleDay(day: number) {
    setSpecificDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  }

  function buildFreqConfig(): FrequencyConfig {
    if (freqType === 'interval_hours')
      return { type: freqType, intervalHours: Number.parseInt(intervalHours) || 8, times };
    if (freqType === 'specific_days') return { type: freqType, specificDays, times };
    return {
      type: freqType,
      daysOn: Number.parseInt(daysOn) || 21,
      daysOff: Number.parseInt(daysOff) || 7,
      times,
    };
  }

  async function launchCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function launchGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  function pickPhoto() {
    Alert.alert('Foto do medicamento', 'Escolha a origem', [
      { text: 'Câmera', onPress: launchCamera },
      { text: 'Galeria', onPress: launchGallery },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const mutation = useMutation({
    mutationFn: async (withSchedule: boolean) => {
      const trimmedName = name.trim();
      const qty = stock.trim() === '' ? 0 : Number.parseFloat(stock);
      const thresh = Number.parseFloat(threshold);
      if (Number.isNaN(qty) || qty < 0) throw new Error('Quantidade inválida.');

      const medicine = await createMedicine({
        name: trimmedName,
        type,
        stockQuantity: qty,
        stockUnit: UNITS[type],
        photoUri,
        lowStockThreshold: Number.isNaN(thresh) ? 5 : thresh,
      });

      if (withSchedule) {
        if (freqType === 'specific_days' && specificDays.length === 0)
          throw new Error('Selecione pelo menos um dia da semana.');
        if (times.length === 0) throw new Error('Adicione pelo menos um horário.');

        const schedule = await createSchedule({
          medicineId: medicine.id,
          dosage: `1 ${UNITS[type]}`,
          doseQuantity: 1,
          frequencyConfig: buildFreqConfig(),
          startDate,
          endDate: undefined,
          isActive: true,
        });

        await generateDosesForSchedule(schedule, 30);

        const now = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          const doses = await getDosesForDate(d.toISOString().split('T')[0]);
          for (const dose of doses) {
            if (dose.scheduleId === schedule.id && new Date(dose.scheduledTime) > now) {
              const notifId = await scheduleDoseNotification({
                id: dose.id,
                medicineName: medicine.name,
                dosage: schedule.dosage,
                scheduledTime: dose.scheduledTime,
              });
              if (notifId) await updateDoseNotificationId(dose.id, notifId);
            }
          }
        }
      }

      return medicine;
    },
    onSuccess: medicine => {
      haptic.success();
      if (medicine.stockQuantity <= medicine.lowStockThreshold) {
        notifyLowStock(medicine).catch(console.error);
      }
      syncToCloud().catch(console.error);
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      router.back();
    },
    onError: (e: Error) => {
      haptic.error();
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    },
  });

  const isLastStep = step === TOTAL_STEPS - 1;
  const canContinue = step === 0 ? name.trim().length > 0 : true;

  return (
    <View style={[main.root, { backgroundColor: C.bg }]}>
      <WizardHeader step={step} onBack={goBack} C={C} topInset={insets.top} />

      {/* Strip deslizável com os 3 passos */}
      <View style={main.clip}>
        <Animated.View style={[main.strip, slideStyle]}>
          <Step1
            name={name}
            setName={setName}
            type={type}
            setType={setType}
            C={C}
            inputRef={nameInputRef}
          />
          <Step2
            type={type}
            stock={stock}
            setStock={setStock}
            threshold={threshold}
            setThreshold={setThreshold}
            photoUri={photoUri}
            onPickPhoto={pickPhoto}
            C={C}
          />
          <Step3
            type={type}
            freqType={freqType}
            setFreqType={setFreqType}
            specificDays={specificDays}
            toggleDay={toggleDay}
            intervalHours={intervalHours}
            setIntervalHours={setIntervalHours}
            daysOn={daysOn}
            setDaysOn={setDaysOn}
            daysOff={daysOff}
            setDaysOff={setDaysOff}
            times={times}
            setTimes={setTimes}
            startDate={startDate}
            setStartDate={setStartDate}
            C={C}
          />
        </Animated.View>
      </View>

      {/* Footer fixo */}
      <View style={[main.footer, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
        {isLastStep ? (
          <>
            <TouchableOpacity
              style={[
                main.btn,
                { backgroundColor: C.primary },
                mutation.isPending && main.btnDisabled,
              ]}
              onPress={() => mutation.mutate(true)}
              disabled={mutation.isPending}
              accessibilityLabel="Salvar medicamento com horário"
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={main.btnText}>
                {mutation.isPending ? 'Salvando...' : 'Salvar com horário'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={main.skipBtn}
              onPress={() => mutation.mutate(false)}
              disabled={mutation.isPending}
              accessibilityLabel="Salvar sem horário"
            >
              <Text style={[main.skipText, { color: C.sub }]}>Salvar sem horário</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[main.btn, { backgroundColor: C.primary }, !canContinue && main.btnDisabled]}
            onPress={goNext}
            disabled={!canContinue}
            accessibilityLabel="Continuar para próximo passo"
          >
            <Text style={main.btnText}>Continuar</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const main = StyleSheet.create({
  root: { flex: 1 },
  clip: { flex: 1, overflow: 'hidden' },
  strip: { flex: 1, flexDirection: 'row', width: TOTAL_STEPS * SCREEN_W },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  btn: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 14, fontWeight: '500' },
});
