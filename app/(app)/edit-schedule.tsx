import { Button } from '@/components/ui/button/Button';
import { DatePickerInput } from '@/components/ui/input/date-picker-input';
import { Input } from '@/components/ui/input/Input';
import { TimePickerInput } from '@/components/ui/input/time-picker-input';
import { IconButton } from '@/components/ui/button/IconButton';
import { SuccessToast } from '@/components/ui/toast/SuccessToast';
import { Text } from '@/components/ui/text/Text';
import { useTheme } from '@/hooks/use-theme';
import { useSchedule } from '@/hooks/use-schedules';
import { deactivateSchedule, updateSchedule } from '@/lib/database';
import { finalizeScheduleUpdate } from '@/lib/dose-scheduling';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import type { FrequencyType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── FormSection ──────────────────────────────────────────────────────────────

function FormSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  const C = useTheme();
  return (
    <View style={sectionStyles.wrap}>
      <Text variant="caption" color={C.sub} style={sectionStyles.title}>
        {title}
      </Text>
      <View style={[sectionStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { gap: 6 },
  title: {
    paddingHorizontal: 4,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

// ─── TimeChip ─────────────────────────────────────────────────────────────────

function TimeChip({ time, onRemove }: Readonly<{ time: string; onRemove: () => void }>) {
  const C = useTheme();
  return (
    <View
      style={[
        chipStyles.chip,
        { backgroundColor: C.primary + '18', borderColor: C.primary + '40' },
      ]}
    >
      <Ionicons name="time-outline" size={13} color={C.primary} />
      <Text variant="label" color={C.primary}>
        {time}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityLabel={`Remover horário ${time}`}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="close" size={14} color={C.primary} />
      </TouchableOpacity>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
});

// ─── EditScheduleScreen ───────────────────────────────────────────────────────

export default function EditScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheduleId = Number.parseInt(id ?? '0');

  const [dosage, setDosage] = useState('');
  const [doseQuantity, setDoseQuantity] = useState('1');
  const [freqType, setFreqType] = useState<FrequencyType>('specific_days');
  const [intervalHours, setIntervalHours] = useState('8');
  const [specificDays, setSpecificDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [daysOn, setDaysOn] = useState('21');
  const [daysOff, setDaysOff] = useState('7');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [timeInput, setTimeInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [successToast, setSuccessToast] = useState<{ title: string; message: string } | null>(null);
  const [backAfterToast, setBackAfterToast] = useState(false);

  const { data: schedule, isLoading } = useSchedule(scheduleId);

  useEffect(() => {
    if (!schedule) return;
    setDosage(schedule.dosage);
    setDoseQuantity(String(schedule.doseQuantity));
    setFreqType(schedule.frequencyConfig.type);
    setIntervalHours(String(schedule.frequencyConfig.intervalHours ?? 8));
    setSpecificDays(schedule.frequencyConfig.specificDays ?? [1, 2, 3, 4, 5]);
    setDaysOn(String(schedule.frequencyConfig.daysOn ?? 21));
    setDaysOff(String(schedule.frequencyConfig.daysOff ?? 7));
    setTimes(schedule.frequencyConfig.times);
    setStartDate(schedule.startDate);
    setEndDate(schedule.endDate ?? '');
  }, [schedule]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!schedule) throw new Error('Agendamento não encontrado');
      if (!dosage.trim()) throw new Error('Informe a dosagem');
      if (times.length === 0) throw new Error('Adicione pelo menos um horário');
      if (freqType === 'specific_days' && specificDays.length === 0)
        throw new Error('Selecione pelo menos um dia da semana');

      const updated = await updateSchedule(scheduleId, {
        dosage: dosage.trim(),
        doseQuantity: Math.max(0.01, Number.parseFloat(doseQuantity) || 1),
        frequencyConfig: buildFreqConfig(),
        startDate,
        endDate: endDate || undefined,
      });

      await finalizeScheduleUpdate(updated, schedule.medicineName ?? '');
    },
    onSuccess: () => {
      invalidateTrackingQueries(qc);
      setBackAfterToast(true);
      setSuccessToast({
        title: 'Horários atualizados!',
        message: 'As próximas doses pendentes foram recalculadas com a nova configuração.',
      });
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateSchedule(scheduleId),
    onSuccess: () => {
      invalidateTrackingQueries(qc);
      router.back();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível desativar o agendamento.'),
  });

  function confirmDeactivate() {
    Alert.alert(
      'Desativar agendamento',
      'As doses futuras pendentes serão removidas. O histórico é preservado. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => deactivateMutation.mutate(),
        },
      ]
    );
  }

  function buildFreqConfig() {
    if (freqType === 'interval_hours') {
      return { type: freqType, intervalHours: Number.parseInt(intervalHours) || 8, times };
    }
    if (freqType === 'specific_days') {
      return { type: freqType, specificDays, times };
    }
    return {
      type: freqType,
      daysOn: Number.parseInt(daysOn) || 21,
      daysOff: Number.parseInt(daysOff) || 7,
      times,
    };
  }

  function removeTime(t: string) {
    setTimes(prev => prev.filter(x => x !== t));
  }

  function toggleDay(day: number) {
    setSpecificDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  }

  function addTime() {
    const t = timeInput || '08:00';
    if (!times.includes(t)) {
      setTimes(prev => [...prev, t].sort((a, b) => a.localeCompare(b)));
    }
    setTimeInput('');
  }

  if (isLoading || !schedule) {
    return (
      <View style={[styles.loading, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <SuccessToast
        visible={!!successToast}
        title={successToast?.title ?? ''}
        message={successToast?.message}
        preset="quick"
        onHide={() => {
          setSuccessToast(null);
          if (backAfterToast) {
            setBackAfterToast(false);
            router.back();
          }
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: C.bg }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 32, 48) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Medicamento ──────────────────────────────────────────────────────── */}
        <FormSection title="Medicamento">
          <View style={styles.medNameRow}>
            <Ionicons name="medical-outline" size={18} color={C.primary} />
            <Text variant="body" style={styles.medNameText}>
              {schedule.medicineName}
            </Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: C.border }]} />
          <View style={styles.dosageRow}>
            <Input
              label="Dosagem *"
              placeholder="Ex: 1 cápsula"
              value={dosage}
              onChangeText={setDosage}
              style={styles.flex}
            />
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: C.border }]} />
          <View style={styles.inlineRow}>
            <Text variant="body" color={C.text}>
              Desconta
            </Text>
            <Input
              placeholder="1"
              keyboardType="decimal-pad"
              value={doseQuantity}
              onChangeText={setDoseQuantity}
              style={styles.shortInput}
            />
            <Text variant="body" color={C.text} style={styles.inlineRowLabel}>
              unidade(s) do estoque por dose
            </Text>
          </View>
        </FormSection>

        {/* ── Frequência ───────────────────────────────────────────────────────── */}
        <FormSection title="Frequência">
          <View style={styles.segmentedWrap}>
            {(
              [
                ['specific_days', 'Dias da semana'],
                ['interval_hours', 'A cada X horas'],
                ['fixed_cycle', 'Ciclo fixo'],
              ] as [FrequencyType, string][]
            ).map(([val, lbl]) => {
              const active = freqType === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.segBtn,
                    {
                      backgroundColor: active ? C.primary : 'transparent',
                      borderColor: active ? C.primary : C.border,
                    },
                  ]}
                  onPress={() => setFreqType(val)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text variant="caption" color={active ? '#fff' : C.sub} style={styles.segText}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: C.border }]} />

          {freqType === 'specific_days' && (
            <View style={styles.daysWrap}>
              {DAYS_PT.map((d, i) => {
                const active = specificDays.includes(i);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayBtn,
                      {
                        backgroundColor: active ? C.primary : C.bg,
                        borderColor: active ? C.primary : C.border,
                      },
                    ]}
                    onPress={() => toggleDay(i)}
                    accessibilityLabel={d}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text variant="caption" color={active ? '#fff' : C.sub} style={styles.dayText}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {freqType === 'interval_hours' && (
            <View style={styles.inlineRow}>
              <Text variant="body" color={C.text}>
                A cada
              </Text>
              <Input
                placeholder="8"
                keyboardType="number-pad"
                value={intervalHours}
                onChangeText={setIntervalHours}
                style={styles.shortInput}
              />
              <Text variant="body" color={C.text} style={styles.inlineRowLabel}>
                horas
              </Text>
            </View>
          )}

          {freqType === 'fixed_cycle' && (
            <View style={styles.cycleWrap}>
              <View style={styles.inlineRow}>
                <Input
                  placeholder="21"
                  keyboardType="number-pad"
                  value={daysOn}
                  onChangeText={setDaysOn}
                  style={styles.shortInput}
                />
                <Text variant="body" color={C.text} style={styles.inlineRowLabel}>
                  dias tomando
                </Text>
              </View>
              <View style={styles.inlineRow}>
                <Input
                  placeholder="7"
                  keyboardType="number-pad"
                  value={daysOff}
                  onChangeText={setDaysOff}
                  style={styles.shortInput}
                />
                <Text variant="body" color={C.text} style={styles.inlineRowLabel}>
                  dias de pausa
                </Text>
              </View>
            </View>
          )}
        </FormSection>

        {/* ── Horários ─────────────────────────────────────────────────────────── */}
        <FormSection title="Horários">
          {times.length > 0 && (
            <View style={styles.timesWrap}>
              {times.map(t => (
                <TimeChip key={t} time={t} onRemove={() => removeTime(t)} />
              ))}
            </View>
          )}
          {times.length > 0 && (
            <View style={[styles.sectionDivider, { backgroundColor: C.border }]} />
          )}
          <View style={styles.addTimeRow}>
            <View style={styles.flex}>
              <TimePickerInput
                label=""
                value={timeInput || '08:00'}
                onChange={val => setTimeInput(val)}
              />
            </View>
            <IconButton
              name="add"
              variant="primary"
              size={20}
              boxSize={44}
              onPress={addTime}
              accessibilityLabel="Adicionar horário"
            />
          </View>
        </FormSection>

        {/* ── Período ──────────────────────────────────────────────────────────── */}
        <FormSection title="Período">
          <View
            style={[
              styles.periodRow,
              { borderBottomColor: C.border, borderBottomWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <DatePickerInput label="Data de início *" value={startDate} onChange={setStartDate} />
          </View>
          <View style={styles.periodRow}>
            <DatePickerInput
              label="Data de término (opcional)"
              value={endDate}
              onChange={setEndDate}
              placeholder="Sem data de término"
            />
          </View>
        </FormSection>

        <Button
          variant="primary"
          size="lg"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          style={styles.submitBtn}
          accessibilityLabel="Salvar alterações"
        >
          Salvar alterações
        </Button>

        <TouchableOpacity
          style={styles.deactivateBtn}
          onPress={confirmDeactivate}
          disabled={deactivateMutation.isPending}
          accessibilityLabel="Desativar agendamento"
          accessibilityRole="button"
        >
          {deactivateMutation.isPending ? (
            <ActivityIndicator color={C.danger} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={C.danger} />
              <Text variant="label" color={C.danger}>
                Desativar agendamento
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  flex: { flex: 1 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },

  // Medicine (read-only)
  medNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  medNameText: { fontWeight: '700' },
  dosageRow: { padding: 4 },

  // Frequency
  segmentedWrap: { flexDirection: 'row', gap: 0, margin: 12 },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 2,
  },
  segText: { textAlign: 'center', fontWeight: '600' },
  daysWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayText: { fontWeight: '700' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  shortInput: { width: 72 },
  inlineRowLabel: { flexShrink: 1 },
  cycleWrap: { gap: 0 },

  // Times
  timesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  addTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },

  // Period
  periodRow: { paddingHorizontal: 4, paddingVertical: 4 },

  submitBtn: { marginTop: 4 },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
  },
});
