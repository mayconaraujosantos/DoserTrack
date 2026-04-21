import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { getDoseById, updateDoseStatus } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import type { DoseStatus } from '@/types';

const STATUS_OPTIONS: { value: DoseStatus; label: string; icon: string; desc: string }[] = [
  { value: 'taken',   label: 'Tomado',   icon: 'checkmark-circle', desc: 'Dose foi tomada' },
  { value: 'skipped', label: 'Pulado',   icon: 'close-circle',     desc: 'Dose foi pulada' },
  { value: 'pending', label: 'Pendente', icon: 'time',             desc: 'Redefinir como pendente' },
];

function statusColor(value: DoseStatus, C: ThemeColors): string {
  if (value === 'taken') return C.success;
  if (value === 'skipped') return C.danger;
  return C.sub;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isoToDate(iso: string | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default function EditDoseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doseId = Number.parseInt(id ?? '0');

  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const dbReady = useAppStore((s) => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: dose, isLoading } = useQuery({
    queryKey: ['dose', doseId],
    queryFn: () => getDoseById(doseId),
    enabled: dbReady && doseId > 0,
  });

  const [status, setStatus] = useState<DoseStatus>('pending');
  const [takenDate, setTakenDate] = useState<Date>(new Date());
  const [skipReason, setSkipReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!dose) return;
    setStatus(dose.status);
    setTakenDate(isoToDate(dose.takenTime));
    setSkipReason(dose.skipReason ?? '');
  }, [dose]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (status === 'taken') {
        await updateDoseStatus(doseId, 'taken', takenDate.toISOString());
      } else if (status === 'skipped') {
        await updateDoseStatus(doseId, 'skipped', undefined, skipReason || undefined);
      } else {
        await updateDoseStatus(doseId, 'pending');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['dose', doseId] });
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['adherence'] });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  if (isLoading || !dose) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.infoCard}>
        <Text style={styles.medicineName}>{dose.medicineName}</Text>
        {dose.dosage ? <Text style={styles.dosage}>{dose.dosage}</Text> : null}
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={C.sub} />
          <Text style={styles.infoText}>Programado: {formatDateTime(dose.scheduledTime)}</Text>
        </View>
        {dose.takenTime && (
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={14} color={C.success} />
            <Text style={[styles.infoText, { color: C.success }]}>
              Tomado em: {formatDateTime(dose.takenTime)}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.label}>Novo status</Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((opt) => {
          const active = status === opt.value;
          const color = statusColor(opt.value, C);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.statusBtn, active && { borderColor: color, backgroundColor: color + '18' }]}
              onPress={() => setStatus(opt.value)}
            >
              <Ionicons name={opt.icon as never} size={22} color={active ? color : C.sub} />
              <Text style={[styles.statusLabel, active && { color }]}>{opt.label}</Text>
              <Text style={styles.statusDesc}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {status === 'taken' && (
        <View style={styles.dateTimeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={C.sub} />
              <Text style={[styles.pickerBtnText, { color: C.text }]}>
                {takenDate.toLocaleDateString('pt-BR')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hora</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={16} color={C.sub} />
              <Text style={[styles.pickerBtnText, { color: C.text }]}>
                {takenDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={takenDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (!date) return;
            const updated = new Date(takenDate);
            updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
            setTakenDate(updated);
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={takenDate}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_: DateTimePickerEvent, date?: Date) => {
            setShowTimePicker(false);
            if (!date) return;
            const updated = new Date(takenDate);
            updated.setHours(date.getHours(), date.getMinutes());
            setTakenDate(updated);
          }}
        />
      )}

      {status === 'skipped' && (
        <View>
          <Text style={styles.label}>Motivo (opcional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Ex: Esqueci, estava dormindo..."
            placeholderTextColor={C.sub}
            value={skipReason}
            onChangeText={setSkipReason}
            multiline
            numberOfLines={3}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Salvar alteração</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, gap: 12, paddingBottom: 40 },
    infoCard: {
      backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 6,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    medicineName: { fontSize: 18, fontWeight: '700', color: C.text },
    dosage: { fontSize: 14, color: C.sub },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    infoText: { fontSize: 13, color: C.sub },
    label: { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 4 },
    statusGrid: { flexDirection: 'row', gap: 8 },
    statusBtn: {
      flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, gap: 4,
      backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
    },
    statusLabel: { fontSize: 13, fontWeight: '700', color: C.sub },
    statusDesc: { fontSize: 10, color: C.sub, textAlign: 'center' },
    dateTimeRow: { flexDirection: 'row', gap: 10 },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 12, paddingHorizontal: 12, height: 48,
      borderWidth: StyleSheet.hairlineWidth,
    },
    pickerBtnText: { fontSize: 14 },
    input: {
      backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, height: 48,
      fontSize: 15, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    multiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
    submitBtn: {
      backgroundColor: C.primary, height: 52, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
