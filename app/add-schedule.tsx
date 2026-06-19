import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  createSchedule,
  getMedicines,
  generateDosesForSchedule,
  updateDoseNotificationId,
  getDosesForDate,
} from '@/lib/database';
import { scheduleDoseNotification } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { TimePickerInput } from '@/components/ui/time-picker-input';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import type { FrequencyType } from '@/types';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function dosagePlaceholder(type: string | undefined): string {
  if (type === 'ml') return 'Ex: 10mL';
  if (type === 'drop') return 'Ex: 5 gotas';
  return 'Ex: 1 cápsula';
}

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

// ─── AddScheduleScreen ────────────────────────────────────────────────────────

export default function AddScheduleScreen() {
  const { medicineId } = useLocalSearchParams<{ medicineId: string }>();
  const [selectedMedId, setSelectedMedId] = useState(medicineId ? Number.parseInt(medicineId) : 0);
  const [dosage, setDosage] = useState('');
  const [freqType, setFreqType] = useState<FrequencyType>('specific_days');
  const [intervalHours, setIntervalHours] = useState('8');
  const [specificDays, setSpecificDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [daysOn, setDaysOn] = useState('21');
  const [daysOff, setDaysOff] = useState('7');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [timeInput, setTimeInput] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState('');

  const C = useTheme();
  const dbReady = useAppStore(s => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: getMedicines,
    enabled: dbReady,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedMedId) throw new Error('Selecione um medicamento');
      if (!dosage.trim()) throw new Error('Informe a dosagem');
      if (times.length === 0) throw new Error('Adicione pelo menos um horário');
      if (freqType === 'specific_days' && specificDays.length === 0)
        throw new Error('Selecione pelo menos um dia da semana');

      const schedule = await createSchedule({
        medicineId: selectedMedId,
        dosage: dosage.trim(),
        frequencyConfig: buildFreqConfig(),
        startDate,
        endDate: endDate || undefined,
        isActive: true,
      });

      await generateDosesForSchedule(schedule, 30);

      const medName = medicines.find(m => m.id === selectedMedId)?.name ?? '';
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const doses = await getDosesForDate(dateStr);
        for (const dose of doses) {
          if (dose.scheduleId === schedule.id && new Date(dose.scheduledTime) > now) {
            const notifId = await scheduleDoseNotification({
              id: dose.id,
              medicineName: medName,
              dosage: schedule.dosage,
              scheduledTime: dose.scheduledTime,
            });
            if (notifId) await updateDoseNotificationId(dose.id, notifId);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

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

  const selectedMed = medicines.find(m => m.id === selectedMedId);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Medicamento ──────────────────────────────────────────────────────── */}
      <FormSection title="Medicamento">
        {medicines.length === 0 ? (
          <View style={styles.emptyMed}>
            <Text variant="caption" color={C.sub}>
              Nenhum medicamento cadastrado.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.medScroll}
          >
            {medicines.map(m => {
              const active = selectedMedId === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.medChip,
                    {
                      backgroundColor: active ? C.primary : C.bg,
                      borderColor: active ? C.primary : C.border,
                    },
                  ]}
                  onPress={() => setSelectedMedId(m.id)}
                  accessibilityLabel={m.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text variant="label" color={active ? '#fff' : C.text}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <View style={[styles.sectionDivider, { backgroundColor: C.border }]} />
        <View style={styles.dosageRow}>
          <Input
            label="Dosagem *"
            placeholder={dosagePlaceholder(selectedMed?.type)}
            value={dosage}
            onChangeText={setDosage}
            style={styles.flex}
          />
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
            <Text variant="body" color={C.text}>
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
              <Text variant="body" color={C.text}>
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
              <Text variant="body" color={C.text}>
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
        accessibilityLabel="Salvar horário"
      >
        Salvar horário
      </Button>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  flex: { flex: 1 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },

  // Medicine selector
  emptyMed: { padding: 16 },
  medScroll: { padding: 12, gap: 8, flexDirection: 'row' },
  medChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
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
  cycleWrap: { gap: 0 },

  // Times
  timesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  addTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },

  // Period
  periodRow: { paddingHorizontal: 4, paddingVertical: 4 },

  submitBtn: { marginTop: 4 },
});
