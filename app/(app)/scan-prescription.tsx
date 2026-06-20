import { useTheme } from '@/hooks/use-theme';
import {
  createMedicine,
  createSchedule,
  generateDosesForSchedule,
  getDosesForDate,
  updateDoseNotificationId,
  updateDoseStatus,
} from '@/lib/database';
import { scheduleDoseNotification } from '@/lib/notifications';
import { scanPrescription, type PrescriptionData } from '@/lib/prescription-scanner';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';

// ─── Constants ───────────────────────────────────────────────────────────────

const UNITS: Record<string, string> = {
  capsule: 'cápsulas',
  tablet: 'comprimidos',
  drop: 'frascos',
  ml: 'mL',
  injection: 'ampolas',
  other: 'unidades',
};

const TYPE_LABELS: Record<string, string> = {
  drop: 'Gota',
  tablet: 'Comprimido',
  capsule: 'Cápsula',
  ml: 'mL',
  injection: 'Injeção',
  other: 'Outro',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Maps time hint words extracted from the prescription to concrete HH:MM times.
 * Falls back to timesPerDay-based defaults when no hints match.
 */
function anchorForInterval(frequencyHours: number): string {
  if (frequencyHours <= 4) return '06:00';
  if (frequencyHours <= 6) return '06:00';
  if (frequencyHours <= 8) return '08:00';
  if (frequencyHours <= 12) return '08:00';
  return '08:00';
}

function smartStartDate(times: string[]): string {
  const today = todayStr();
  const now = new Date();
  const allPassed = times.every(t => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d <= now;
  });
  return allPassed ? addDays(today, 1) : today;
}

function timeHintsToSchedule(
  hints: string[],
  timesPerDay: number | null | undefined,
  frequencyHours: number | null | undefined
): string[] {
  if (frequencyHours) {
    return [anchorForInterval(frequencyHours)];
  }

  const HINT_MAP: Record<string, string> = {
    manhã: '08:00',
    manha: '08:00',
    'em jejum': '07:00',
    jejum: '07:00',
    café: '08:00',
    cafe: '08:00',
    almoço: '12:00',
    almoco: '12:00',
    tarde: '15:00',
    jantar: '20:00',
    'após jantar': '20:00',
    'apos jantar': '20:00',
    noite: '20:00',
    deitar: '22:00',
    dormir: '22:00',
    'antes de dormir': '22:00',
  };

  const matched: string[] = [];
  for (const hint of hints ?? []) {
    const key = hint.toLowerCase().trim();
    const match = HINT_MAP[key];
    if (match && !matched.includes(match)) matched.push(match);
  }
  if (matched.length > 0) return matched.sort();

  const n = timesPerDay ?? 1;
  if (n === 1) return ['08:00'];
  if (n === 2) return ['08:00', '20:00'];
  if (n === 3) return ['08:00', '14:00', '20:00'];
  if (n >= 4) return ['07:00', '12:00', '17:00', '22:00'];
  return ['08:00'];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmState {
  item: PrescriptionData;
  times: string[];
  startDate: string;
  durationDays: string;
  isContinuous: boolean;
  dosage: string;
}

type SavedPrescriptionData = PrescriptionData & { _saved?: boolean };

// ─── TimeChipRow ─────────────────────────────────────────────────────────────

function TimeChipRow({
  times,
  onAdd,
  onRemove,
}: Readonly<{
  times: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
}>) {
  const C = useTheme();
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(new Date());

  function handleChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const t = `${pad(selected.getHours())}:${pad(selected.getMinutes())}`;
        if (!times.includes(t)) onAdd(t);
      }
    } else if (selected) {
      setPending(selected);
    }
  }

  function confirmIos() {
    const pad = (n: number) => String(n).padStart(2, '0');
    const t = `${pad(pending.getHours())}:${pad(pending.getMinutes())}`;
    if (!times.includes(t)) onAdd(t);
    setShow(false);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {times.map(t => (
          <TouchableOpacity
            key={t}
            style={[chipStyles.chip, { backgroundColor: C.primary + '22' }]}
            onPress={() => onRemove(t)}
            accessibilityLabel={`Remover horário ${t}`}
          >
            <Text variant="label" color={C.primary}>
              {t}
            </Text>
            <Ionicons name="close" size={13} color={C.primary} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            chipStyles.chip,
            { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
          ]}
          onPress={() => setShow(true)}
          accessibilityLabel="Adicionar horário"
        >
          <Ionicons name="add" size={14} color={C.sub} />
          <Text variant="label" color={C.sub}>
            Horário
          </Text>
        </TouchableOpacity>
      </View>

      {show && (
        <>
          <DateTimePicker
            value={pending}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[chipStyles.confirmBtn, { backgroundColor: C.primary }]}
              onPress={confirmIos}
            >
              <Text variant="label" color="#fff">
                Confirmar
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confirmBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
});

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  state,
  onConfirm,
  onCancel,
}: Readonly<{
  state: ConfirmState;
  onConfirm: (s: ConfirmState) => void;
  onCancel: () => void;
}>) {
  const C = useTheme();
  const [times, setTimes] = useState(state.times);
  const [durationDays, setDurationDays] = useState(state.durationDays);
  const [isContinuous, setIsContinuous] = useState(state.isContinuous);
  const [dosage, setDosage] = useState(state.dosage);

  const isSos = state.item.isSos === true;

  const freqLabel = state.item.frequencyHours
    ? `A cada ${state.item.frequencyHours}h`
    : state.item.timesPerDay
      ? `${state.item.timesPerDay}x ao dia`
      : state.item.timesPerWeek
        ? `${state.item.timesPerWeek}x por semana`
        : 'Conforme receita';

  function handleConfirm() {
    if (!isSos && times.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um horário.');
      return;
    }
    onConfirm({ ...state, times, durationDays, isContinuous, dosage });
  }

  function toggleContinuous() {
    const next = !isContinuous;
    setIsContinuous(next);
    if (next) setDurationDays('');
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={[modalStyles.overlay]}>
        <View style={[modalStyles.sheet, { backgroundColor: C.bg }]}>
          <View style={[modalStyles.handle, { backgroundColor: C.border }]} />

          <View style={modalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="title" numberOfLines={1}>
                {state.item.name}
              </Text>
              {state.item.concentration && (
                <Text variant="sub" color={C.sub}>
                  {state.item.concentration}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Fechar modal">
              <Ionicons name="close" size={24} color={C.sub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {isSos && (
              <View
                style={[
                  modalStyles.sosBanner,
                  { backgroundColor: '#F4A26118', borderColor: '#F4A26144' },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={18} color="#F4A261" />
                <Text variant="caption" color="#F4A261" style={{ flex: 1, lineHeight: 18 }}>
                  Uso condicional (SOS): tome apenas quando necessário. Nenhum alarme será criado.
                </Text>
              </View>
            )}

            {!isSos && (
              <View style={modalStyles.section}>
                <Text variant="caption" color={C.sub} style={modalStyles.sectionLabel}>
                  Frequência detectada
                </Text>
                <Text variant="body">{freqLabel}</Text>
              </View>
            )}

            {state.item.instructions ? (
              <View style={modalStyles.section}>
                <Text variant="caption" color={C.sub} style={modalStyles.sectionLabel}>
                  Instruções da receita
                </Text>
                <Text variant="body">{state.item.instructions}</Text>
              </View>
            ) : null}

            <View style={modalStyles.section}>
              <Input
                label="Dosagem"
                value={dosage}
                onChangeText={setDosage}
                placeholder="Ex: 1 comprimido"
              />
            </View>

            {!isSos && (
              <>
                <View
                  style={[
                    modalStyles.section,
                    modalStyles.startDateRow,
                    { backgroundColor: C.primary + '12', borderColor: C.primary + '33' },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={16} color={C.primary} />
                  <Text variant="caption" color={C.primary}>
                    {state.startDate === todayStr()
                      ? `Primeira dose hoje às ${times[0]}`
                      : `Primeira dose amanhã às ${times[0]} — horários de hoje já passaram`}
                  </Text>
                </View>

                <View style={modalStyles.section}>
                  <Text variant="caption" color={C.sub} style={modalStyles.sectionLabel}>
                    Horários de lembrete
                  </Text>
                  <TimeChipRow
                    times={times}
                    onAdd={t => setTimes(prev => [...prev, t].sort())}
                    onRemove={t => setTimes(prev => prev.filter(x => x !== t))}
                  />
                </View>

                <View style={modalStyles.section}>
                  <View style={modalStyles.row}>
                    <Text variant="caption" color={C.sub}>
                      Uso contínuo
                    </Text>
                    <TouchableOpacity
                      style={[
                        modalStyles.toggle,
                        { backgroundColor: isContinuous ? C.primary : C.border },
                      ]}
                      onPress={toggleContinuous}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isContinuous }}
                    >
                      <View
                        style={[modalStyles.toggleThumb, isContinuous && modalStyles.toggleThumbOn]}
                      />
                    </TouchableOpacity>
                  </View>

                  {!isContinuous && (
                    <View style={[modalStyles.row, { marginTop: 10 }]}>
                      <Text variant="caption" color={C.sub} style={{ flex: 1 }}>
                        Duração (dias)
                      </Text>
                      <TextInput
                        style={[
                          modalStyles.durationInput,
                          { backgroundColor: C.card, borderColor: C.border, color: C.text },
                        ]}
                        keyboardType="number-pad"
                        value={durationDays}
                        onChangeText={setDurationDays}
                        placeholder="30"
                        placeholderTextColor={C.sub}
                      />
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          <Button
            variant="primary"
            size="lg"
            icon={
              isSos ? (
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              ) : (
                <Ionicons name="alarm-outline" size={20} color="#fff" />
              )
            }
            onPress={handleConfirm}
            style={modalStyles.saveBtn}
            accessibilityLabel={
              isSos ? 'Salvar medicamento SOS' : 'Salvar medicamento e criar alarmes'
            }
          >
            {isSos ? 'Salvar medicamento' : 'Salvar e criar alarmes'}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    gap: 4,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  section: { marginBottom: 16 },
  sectionLabel: { marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  durationInput: {
    width: 80,
    textAlign: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: { marginTop: 8 },
  startDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  sosBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
});

// ─── MedicineResultCard ───────────────────────────────────────────────────────

function MedicineResultCard({
  item,
  index,
  onAdd,
  externalSaving,
  externalSaved,
}: Readonly<{
  item: PrescriptionData;
  index: number;
  onAdd: (item: PrescriptionData) => void;
  externalSaving: boolean;
  externalSaved: boolean;
}>) {
  const C = useTheme();

  return (
    <Card variant="outlined" style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={[styles.resultBadge, { backgroundColor: C.primary + '22' }]}>
          <Text variant="caption" color={C.primary} style={styles.resultBadgeText}>
            {index + 1}
          </Text>
        </View>
        <Text variant="title" style={styles.resultHeaderText} numberOfLines={1}>
          {item.name}
        </Text>
        {externalSaved ? (
          <View style={[styles.actionBadge, { backgroundColor: C.success }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text variant="label" color="#fff">
              Salvo
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionBadge,
              { backgroundColor: C.primary },
              externalSaving && { opacity: 0.6 },
            ]}
            onPress={() => onAdd(item)}
            disabled={externalSaving}
            accessibilityLabel={externalSaving ? `Salvando ${item.name}` : `Adicionar ${item.name}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: externalSaving }}
          >
            {externalSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={18} color="#fff" />
            )}
            <Text variant="label" color="#fff">
              {externalSaving ? 'Salvando...' : 'Adicionar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {item.isSos && (
        <View style={[styles.sosBadge, { backgroundColor: '#F4A26122' }]}>
          <Ionicons name="alert-circle-outline" size={13} color="#F4A261" />
          <Text variant="label" color="#F4A261">
            Uso condicional (SOS) — sem alarmes automáticos
          </Text>
        </View>
      )}
      {item.concentration && <ResultRow label="Concentração" value={item.concentration} C={C} />}
      <ResultRow label="Forma" value={TYPE_LABELS[item.type] ?? item.type} C={C} />
      {!item.isSos && item.frequencyHours != null && (
        <ResultRow label="Frequência" value={`A cada ${item.frequencyHours}h`} C={C} />
      )}
      {!item.isSos && item.timesPerDay != null && !item.frequencyHours && (
        <ResultRow label="Frequência" value={`${item.timesPerDay}x ao dia`} C={C} />
      )}
      {item.durationDays != null && (
        <ResultRow label="Duração" value={`${item.durationDays} dias`} C={C} />
      )}
      {item.isContinuous && <ResultRow label="Uso" value="Contínuo" C={C} />}
      {item.instructions && <ResultRow label="Instruções" value={item.instructions} C={C} small />}
    </Card>
  );
}

function ResultRow({
  label,
  value,
  C,
  small,
}: {
  label: string;
  value: string;
  C: ReturnType<typeof useTheme>;
  small?: boolean;
}) {
  return (
    <View style={[styles.resultRow, { borderBottomColor: C.border }]}>
      <Text variant="caption" color={C.sub} style={styles.resultLabel}>
        {label}
      </Text>
      <Text variant={small ? 'caption' : 'label'} style={styles.resultValue}>
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScanPrescriptionScreen() {
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<SavedPrescriptionData[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const C = useTheme();
  const qc = useQueryClient();

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para continuar.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      base64: true,
    });
    if (!picked.canceled && picked.assets[0]) {
      setImageUri(picked.assets[0].uri);
      setImageBase64(picked.assets[0].base64 ?? undefined);
      setResults([]);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para continuar.');
      return;
    }
    const taken = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      base64: true,
    });
    if (!taken.canceled && taken.assets[0]) {
      setImageUri(taken.assets[0].uri);
      setImageBase64(taken.assets[0].base64 ?? undefined);
      setResults([]);
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    setScanning(true);
    setResults([]);
    try {
      const data = await scanPrescription(imageBase64);
      setResults(data);
    } catch (err) {
      Alert.alert('Erro ao analisar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setScanning(false);
    }
  }

  function requestAddMedicine(item: PrescriptionData) {
    const suggestedTimes = timeHintsToSchedule(
      item.timeHints ?? [],
      item.timesPerDay,
      item.frequencyHours
    );
    setConfirmState({
      item,
      times: suggestedTimes,
      startDate: smartStartDate(suggestedTimes),
      durationDays: item.durationDays ? String(item.durationDays) : '',
      isContinuous: item.isContinuous ?? !item.durationDays,
      dosage: item.instructions ?? 'Conforme receita',
    });
  }

  async function handleConfirmSave(state: ConfirmState) {
    const { item, times, durationDays, isContinuous, dosage } = state;
    const isSos = item.isSos === true;
    setSavingKey(item.name);
    setConfirmState(null);

    try {
      const fullName = item.concentration ? `${item.name} ${item.concentration}` : item.name;
      const medicine = await createMedicine({
        name: fullName,
        type: item.type,
        stockQuantity: item.quantity ?? 0,
        stockUnit: UNITS[item.type] ?? 'unidades',
        lowStockThreshold: 2,
      });

      if (!isSos) {
        const today = state.startDate;
        const parsedDuration = Number.parseInt(durationDays);
        const endDate =
          !isContinuous && !Number.isNaN(parsedDuration) && parsedDuration > 0
            ? addDays(today, parsedDuration - 1)
            : undefined;

        let freqConfig;
        if (item.frequencyHours) {
          freqConfig = {
            type: 'interval_hours' as const,
            intervalHours: item.frequencyHours,
            times,
          };
        } else if (item.timesPerWeek) {
          freqConfig = { type: 'specific_days' as const, specificDays: [1], times };
        } else {
          freqConfig = {
            type: 'specific_days' as const,
            specificDays: [0, 1, 2, 3, 4, 5, 6],
            times,
          };
        }

        const schedule = await createSchedule({
          medicineId: medicine.id,
          dosage,
          frequencyConfig: freqConfig,
          startDate: today,
          endDate,
          isActive: true,
        });

        await generateDosesForSchedule(schedule, 30);

        // Marca como skipped doses já passadas no dia de hoje para evitar status "atrasado" imediato
        const now = new Date();
        const realToday = todayStr();
        const todayDoses = await getDosesForDate(realToday);
        for (const dose of todayDoses) {
          if (dose.scheduleId === schedule.id && new Date(dose.scheduledTime) <= now) {
            await updateDoseStatus(dose.id, 'skipped');
          }
        }

        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const doses = await getDosesForDate(dateStr);
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

      setResults(prev => prev.map(r => (r === item ? { ...r, _saved: true } : r)));

      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['week-adherence'] });
      qc.invalidateQueries({ queryKey: ['streak'] });
    } catch (err) {
      Alert.alert('Erro ao salvar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setSavingKey(null);
    }
  }

  function reset() {
    setResults([]);
    setImageUri(undefined);
    setImageBase64(undefined);
  }

  return (
    <>
      {confirmState && (
        <ConfirmModal
          state={confirmState}
          onConfirm={handleConfirmSave}
          onCancel={() => setConfirmState(null)}
        />
      )}

      <ScrollView
        style={[styles.container, { backgroundColor: C.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="body" color={C.sub} style={styles.subtitle}>
          Fotografe ou selecione a receita para preencher os medicamentos automaticamente.
        </Text>

        <View style={[styles.imageArea, { borderColor: C.border, backgroundColor: C.card }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="document-text-outline" size={56} color={C.border} />
              <Text variant="body" color={C.sub}>
                Nenhuma imagem selecionada
              </Text>
            </View>
          )}
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity
            style={[styles.captureBtn, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={takePhoto}
            accessibilityLabel="Tirar foto com câmera"
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={20} color={C.primary} />
            <Text variant="label" color={C.primary}>
              Câmera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={pickFromGallery}
            accessibilityLabel="Selecionar imagem da galeria"
            accessibilityRole="button"
          >
            <Ionicons name="images-outline" size={20} color={C.primary} />
            <Text variant="label" color={C.primary}>
              Galeria
            </Text>
          </TouchableOpacity>
        </View>

        {!!imageUri && results.length === 0 && (
          <Button
            variant="primary"
            size="lg"
            loading={scanning}
            onPress={analyze}
            icon={
              !scanning ? <Ionicons name="sparkles-outline" size={20} color="#fff" /> : undefined
            }
            style={styles.analyzeBtn}
            accessibilityLabel={
              scanning ? 'Analisando receita' : 'Analisar receita com inteligência artificial'
            }
          >
            {scanning ? 'Analisando receita...' : 'Analisar Receita'}
          </Button>
        )}

        {results.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Ionicons name="checkmark-circle" size={20} color={C.success} />
              <Text variant="label">
                {results.length} medicamento{results.length > 1 ? 's' : ''} encontrado
                {results.length > 1 ? 's' : ''}
              </Text>
            </View>

            {results.map((item, index) => (
              <MedicineResultCard
                key={`${item.name}-${index}`}
                item={item}
                index={index}
                onAdd={requestAddMedicine}
                externalSaving={savingKey === item.name}
                externalSaved={item._saved === true}
              />
            ))}

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={reset}
              accessibilityLabel="Escanear outra receita"
              accessibilityRole="button"
            >
              <Text variant="body" color={C.sub} style={styles.retryBtnText}>
                Escanear outra receita
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  subtitle: { lineHeight: 20 },
  imageArea: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    minHeight: 220,
  },
  image: { width: '100%', height: 320 },
  imagePlaceholder: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  captureRow: { flexDirection: 'row', gap: 12 },
  captureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  analyzeBtn: {},
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultCard: { gap: 8 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  resultBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadgeText: { fontWeight: '700' },
  resultHeaderText: { flex: 1 },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultLabel: { flex: 1 },
  resultValue: { flex: 2, textAlign: 'right' },
  retryBtn: { alignItems: 'center', paddingVertical: 8 },
  retryBtnText: { textDecorationLine: 'underline' },
  sosBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 4,
  },
});
