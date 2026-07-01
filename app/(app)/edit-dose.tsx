import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/form/Input';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import {
  getDoseById,
  getDosesForDate,
  realignIntervalSchedule,
  updateDoseNotificationId,
  updateDoseStatus,
} from '@/lib/database';
import { scheduleDoseNotification } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import type { DoseStatus } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_OPTIONS: { value: DoseStatus; label: string; icon: string; desc: string }[] = [
  { value: 'taken', label: 'Tomado', icon: 'checkmark-circle', desc: 'Dose foi tomada' },
  { value: 'skipped', label: 'Pulado', icon: 'close-circle', desc: 'Dose foi pulada' },
  { value: 'pending', label: 'Pendente', icon: 'time', desc: 'Redefinir como pendente' },
];

function statusColor(value: DoseStatus, success: string, danger: string, sub: string): string {
  if (value === 'taken') return success;
  if (value === 'skipped') return danger;
  return sub;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
  const insets = useSafeAreaInsets();
  const dbReady = useAppStore(s => s.dbReady);
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

  function isTimeShifted(scheduledIso: string, taken: Date): boolean {
    const scheduled = new Date(scheduledIso);
    const diffMinutes = Math.abs(taken.getTime() - scheduled.getTime()) / 60_000;
    return diffMinutes >= 5;
  }

  async function rescheduleAfterRealign(scheduleId: number) {
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayDoses = await getDosesForDate(dateStr);
      for (const futureDose of dayDoses) {
        if (
          futureDose.scheduleId === scheduleId &&
          futureDose.status === 'pending' &&
          new Date(futureDose.scheduledTime) > now &&
          !futureDose.notificationId
        ) {
          const notifId = await scheduleDoseNotification({
            id: futureDose.id,
            medicineName: futureDose.medicineName ?? '',
            dosage: futureDose.dosage ?? '',
            scheduledTime: futureDose.scheduledTime,
          });
          if (notifId) await updateDoseNotificationId(futureDose.id, notifId);
        }
      }
    }
  }

  const mutation = useMutation({
    mutationFn: async (): Promise<{ realigned: boolean }> => {
      if (status === 'taken') {
        const takenIso = takenDate.toISOString();
        await updateDoseStatus(doseId, 'taken', takenIso);
        if (dose && isTimeShifted(dose.scheduledTime, takenDate)) {
          await realignIntervalSchedule(dose.scheduleId, takenIso);
          await rescheduleAfterRealign(dose.scheduleId);
          return { realigned: true };
        }
      } else if (status === 'skipped') {
        await updateDoseStatus(doseId, 'skipped', undefined, skipReason || undefined);
      } else {
        await updateDoseStatus(doseId, 'pending');
      }
      return { realigned: false };
    },
    onSuccess: ({ realigned }) => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['dose', doseId] });
      qc.invalidateQueries({ queryKey: ['history'] });
      qc.invalidateQueries({ queryKey: ['adherence'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
      if (realigned) {
        Alert.alert(
          'Horários realinhados',
          'As próximas doses foram reagendadas a partir do horário em que você tomou.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        router.back();
      }
    },
    onError: (e: Error) => Alert.alert('Erro', e.message),
  });

  if (isLoading || !dose) {
    return (
      <View style={[styles.loading, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}
      keyboardShouldPersistTaps="handled"
    >
      <Card variant="outlined" style={styles.infoCard}>
        <Text variant="title">{dose.medicineName}</Text>
        {dose.dosage ? <Text variant="sub">{dose.dosage}</Text> : null}
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={C.sub} />
          <Text variant="caption" color={C.sub}>
            Programado: {formatDateTime(dose.scheduledTime)}
          </Text>
        </View>
        {dose.takenTime && (
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={14} color={C.success} />
            <Text variant="caption" color={C.success}>
              Tomado em: {formatDateTime(dose.takenTime)}
            </Text>
          </View>
        )}
      </Card>

      <Text variant="label" color={C.sub} style={styles.sectionLabel}>
        Novo status
      </Text>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map(opt => {
          const active = status === opt.value;
          const color = statusColor(opt.value, C.success, C.danger, C.sub);
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.statusBtn,
                { backgroundColor: C.card, borderColor: active ? color : C.border },
                active && { backgroundColor: color + '18' },
              ]}
              onPress={() => setStatus(opt.value)}
              accessibilityLabel={opt.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={opt.icon as never} size={22} color={active ? color : C.sub} />
              <Text variant="label" color={active ? color : C.sub}>
                {opt.label}
              </Text>
              <Text variant="caption" color={C.sub} style={styles.statusDesc}>
                {opt.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {status === 'taken' && (
        <View style={styles.dateTimeRow}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={C.sub} style={styles.sectionLabel}>
              Data
            </Text>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={C.sub} />
              <Text variant="body" color={C.text}>
                {takenDate.toLocaleDateString('pt-BR')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={C.sub} style={styles.sectionLabel}>
              Hora
            </Text>
            <TouchableOpacity
              style={[styles.pickerBtn, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={16} color={C.sub} />
              <Text variant="body" color={C.text}>
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
        <Input
          label="Motivo (opcional)"
          placeholder="Ex: Esqueci, estava dormindo..."
          value={skipReason}
          onChangeText={setSkipReason}
          multiline
          numberOfLines={3}
          style={styles.multiline}
        />
      )}

      <Button
        variant="primary"
        size="lg"
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
        style={styles.submitBtn}
        accessibilityLabel="Salvar alteração"
      >
        Salvar alteração
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  infoCard: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  sectionLabel: { marginBottom: 4 },
  statusGrid: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1.5,
  },
  statusDesc: { textAlign: 'center' },
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  submitBtn: { marginTop: 4 },
});
