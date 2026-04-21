import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  createSchedule, getMedicines, generateDosesForSchedule,
  updateDoseNotificationId, getDosesForDate,
} from '@/lib/database';
import { scheduleDoseNotification } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { TimePickerInput } from '@/components/ui/time-picker-input';
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

function TimeChip({ time, onRemove, C }: Readonly<{ time: string; onRemove: () => void; C: ThemeColors }>) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: C.primary + '22' }]}>
      <Text style={[chipStyles.text, { color: C.primary }]}>{time}</Text>
      <TouchableOpacity onPress={onRemove}>
        <Ionicons name="close" size={14} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  text: { fontSize: 13, fontWeight: '600' },
});

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
  const styles = useMemo(() => makeStyles(C), [C]);
  const dbReady = useAppStore((s) => s.dbReady);
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

      const schedule = await createSchedule({
        medicineId: selectedMedId,
        dosage: dosage.trim(),
        frequencyConfig: buildFreqConfig(),
        startDate,
        endDate: endDate || undefined,
        isActive: true,
      });

      await generateDosesForSchedule(schedule, 30);

      const medName = medicines.find((m) => m.id === selectedMedId)?.name ?? '';
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
    setTimes((prev) => prev.filter((x) => x !== t));
  }

  function toggleDay(day: number) {
    setSpecificDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  const selectedMed = medicines.find((m) => m.id === selectedMedId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <Text style={styles.label}>Medicamento *</Text>
      {medicines.length === 0 ? (
        <Text style={styles.hint}>Nenhum medicamento cadastrado. Adicione um primeiro.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.medScroll}>
          {medicines.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.medChip, selectedMedId === m.id && styles.medChipActive]}
              onPress={() => setSelectedMedId(m.id)}
            >
              <Text style={[styles.medChipText, selectedMedId === m.id && styles.medChipTextActive]}>
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.label}>Dosagem *</Text>
      <TextInput
        style={styles.input}
        placeholder={dosagePlaceholder(selectedMed?.type)}
        placeholderTextColor={C.sub}
        value={dosage}
        onChangeText={setDosage}
      />

      <Text style={styles.label}>Frequência</Text>
      <View style={styles.segmented}>
        {([
          ['specific_days', 'Dias da semana'],
          ['interval_hours', 'A cada X horas'],
          ['fixed_cycle', 'Ciclo fixo'],
        ] as [FrequencyType, string][]).map(([val, lbl]) => (
          <TouchableOpacity
            key={val}
            style={[styles.segBtn, freqType === val && styles.segBtnActive]}
            onPress={() => setFreqType(val)}
          >
            <Text style={[styles.segText, freqType === val && styles.segTextActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {freqType === 'specific_days' && (
        <View style={styles.daysRow}>
          {DAYS_PT.map((d, i) => (
            <TouchableOpacity
              key={d}
              style={[styles.dayBtn, specificDays.includes(i) && styles.dayBtnActive]}
              onPress={() => toggleDay(i)}
            >
              <Text style={[styles.dayText, specificDays.includes(i) && styles.dayTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {freqType === 'interval_hours' && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>A cada</Text>
          <TextInput
            style={[styles.input, styles.shortInput]}
            keyboardType="number-pad"
            value={intervalHours}
            onChangeText={setIntervalHours}
          />
          <Text style={styles.rowLabel}>horas</Text>
        </View>
      )}

      {freqType === 'fixed_cycle' && (
        <View style={styles.cycleRow}>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.shortInput]} keyboardType="number-pad" value={daysOn} onChangeText={setDaysOn} />
            <Text style={styles.rowLabel}>dias tomando</Text>
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.shortInput]} keyboardType="number-pad" value={daysOff} onChangeText={setDaysOff} />
            <Text style={styles.rowLabel}>dias de pausa</Text>
          </View>
        </View>
      )}

      <Text style={styles.label}>Horários</Text>
      <View style={styles.timesBox}>
        {times.map((t) => (
          <TimeChip key={t} time={t} C={C} onRemove={() => removeTime(t)} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TimePickerInput
            label=""
            value={timeInput || '08:00'}
            onChange={(val) => setTimeInput(val)}
          />
        </View>
        <TouchableOpacity style={styles.addTimeBtn} onPress={() => {
          if (timeInput && !times.includes(timeInput)) {
            setTimes((prev) => [...prev, timeInput].sort((a, b) => a.localeCompare(b)));
          }
          setTimeInput('');
        }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <DatePickerInput
        label="Data de início *"
        value={startDate}
        onChange={setStartDate}
      />

      <DatePickerInput
        label="Data de término (opcional)"
        value={endDate}
        onChange={setEndDate}
        placeholder="Sem data de término"
      />

      <TouchableOpacity
        style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Salvar horário</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, gap: 8, paddingBottom: 40 },
    label: { fontSize: 13, fontWeight: '600', color: C.sub, marginTop: 8, marginBottom: 4 },
    hint: { fontSize: 13, color: C.sub, fontStyle: 'italic' },
    input: {
      backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, height: 48,
      fontSize: 15, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    shortInput: { width: 70, textAlign: 'center' },
    medScroll: { marginBottom: 4 },
    medChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
      backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    medChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    medChipText: { fontSize: 14, color: C.sub },
    medChipTextActive: { color: '#fff', fontWeight: '600' },
    segmented: { flexDirection: 'row', gap: 6 },
    segBtn: {
      flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
      backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    segBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    segText: { fontSize: 11, color: C.sub, fontWeight: '500', textAlign: 'center' },
    segTextActive: { color: '#fff' },
    daysRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    dayBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    dayBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    dayText: { fontSize: 11, color: C.sub, fontWeight: '600' },
    dayTextActive: { color: '#fff' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowLabel: { fontSize: 14, color: C.text },
    cycleRow: { gap: 8 },
    timesBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    addTimeBtn: {
      backgroundColor: C.primary, width: 48, height: 48,
      borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    },
    submitBtn: {
      backgroundColor: C.primary, height: 52, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center', marginTop: 16,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
