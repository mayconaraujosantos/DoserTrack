import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDoseById, updateDoseStatus } from '@/lib/database';
import { scheduleSnoozeNotification, cancelNotification } from '@/lib/notifications';
import { haptic } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';

// This screen always uses a dark overlay regardless of OS theme
const DARK = {
  bg: '#1A2340',
  card: 'rgba(255,255,255,0.07)',
  text: '#FFFFFF',
  sub: '#94A3B8',
  border: 'rgba(255,255,255,0.15)',
  primary: '#5B9FE6',
  success: '#2ECC71',
  danger: '#E05252',
  warning: '#F39C12',
} as const;

const SNOOZE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '30 min', minutes: 30 },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK.bg, padding: 32, justifyContent: 'center' },
  center: { alignItems: 'center' },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(91,159,230,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  iconInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(91,159,230,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: DARK.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  medicineName: { fontSize: 20, fontWeight: '700', color: DARK.text, textAlign: 'center' },
  dosage: { fontSize: 15, color: DARK.sub, textAlign: 'center', marginTop: 4 },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 32,
  },
  timeText: { fontSize: 14, color: DARK.sub },
  actions: { gap: 10 },
  takeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DARK.success,
    height: 52,
    borderRadius: 16,
  },
  takeBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  // Snooze row
  snoozeRow: { flexDirection: 'row', gap: 8 },
  snoozeOptionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeOptionText: { fontSize: 14, fontWeight: '600' },
  snoozeLabel: { textAlign: 'center', fontSize: 12, color: DARK.sub, marginBottom: 4 },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
  },
  skipBtnText: { fontSize: 15, color: DARK.sub },
  btnDisabled: { opacity: 0.5 },
  snoozeConfirmBtn: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderColor: DARK.primary,
  },
  snoozeConfirmText: { fontSize: 14, fontWeight: '700', color: DARK.primary },
  skipReasonContainer: { gap: 10 },
  skipInput: {
    backgroundColor: DARK.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: DARK.text,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  skipBtnRow: { flexDirection: 'row', gap: 10 },
  skipCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DARK.border,
  },
  skipCancelText: { color: DARK.sub, fontWeight: '600' },
  skipConfirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK.danger,
  },
  skipConfirmText: { color: '#fff', fontWeight: '700' },
});

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ReminderAlertScreen() {
  const { doseId } = useLocalSearchParams<{ doseId: string }>();
  const [showSkipReason, setShowSkipReason] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [selectedSnooze, setSelectedSnooze] = useState(10);
  const dbReady = useAppStore(s => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();

  const id = doseId ? Number.parseInt(doseId) : 0;

  const { data: dose, isLoading } = useQuery({
    queryKey: ['dose', id],
    queryFn: () => getDoseById(id),
    enabled: dbReady && id > 0,
  });

  const takeMutation = useMutation({
    mutationFn: async () => {
      if (dose?.notificationId) await cancelNotification(dose.notificationId);
      await updateDoseStatus(id, 'taken', new Date().toISOString());
    },
    onSuccess: () => {
      haptic.success();
      qc.invalidateQueries({ queryKey: ['doses'] });
      router.back();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      if (dose?.notificationId) await cancelNotification(dose.notificationId);
      await updateDoseStatus(id, 'snoozed');
      if (dose) {
        await scheduleSnoozeNotification(
          {
            id: dose.id,
            medicineName: dose.medicineName ?? '',
            dosage: dose.dosage ?? '',
          },
          selectedSnooze
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      router.back();
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      if (dose?.notificationId) await cancelNotification(dose.notificationId);
      await updateDoseStatus(id, 'skipped', undefined, skipReason || undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doses'] });
      router.back();
    },
  });

  function handleSkip() {
    if (!showSkipReason) {
      setShowSkipReason(true);
      return;
    }
    skipMutation.mutate();
  }

  const isPending = takeMutation.isPending || snoozeMutation.isPending || skipMutation.isPending;

  if (isLoading || !dose) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={DARK.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconOuter}>
        <View style={styles.iconInner}>
          <Ionicons name="medical" size={34} color={DARK.primary} />
        </View>
      </View>

      <Text style={styles.title}>Hora do remédio!</Text>
      <Text style={styles.medicineName}>{dose.medicineName}</Text>
      {dose.dosage ? <Text style={styles.dosage}>{dose.dosage}</Text> : null}

      <View style={styles.timeBox}>
        <Ionicons name="time-outline" size={16} color={DARK.sub} />
        <Text style={styles.timeText}>Programado para {formatTime(dose.scheduledTime)}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.takeBtn, isPending && styles.btnDisabled]}
          onPress={() => takeMutation.mutate()}
          disabled={isPending}
          accessibilityLabel="Tomar medicamento agora"
          accessibilityRole="button"
        >
          {takeMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.takeBtnText}>Tomar agora</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Snooze com opções */}
        <View>
          <Text style={styles.snoozeLabel}>Adiar por:</Text>
          <View style={styles.snoozeRow}>
            {SNOOZE_OPTIONS.map(opt => {
              const active = selectedSnooze === opt.minutes;
              return (
                <TouchableOpacity
                  key={opt.minutes}
                  style={[
                    styles.snoozeOptionBtn,
                    {
                      borderColor: active ? DARK.primary : DARK.border,
                      backgroundColor: active ? 'rgba(91,159,230,0.18)' : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedSnooze(opt.minutes)}
                  disabled={isPending}
                  accessibilityLabel={`Adiar ${opt.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.snoozeOptionText, { color: active ? DARK.primary : DARK.sub }]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.snoozeConfirmBtn, isPending && styles.btnDisabled]}
            onPress={() => snoozeMutation.mutate()}
            disabled={isPending}
            accessibilityLabel={`Confirmar adiamento de ${selectedSnooze} minutos`}
            accessibilityRole="button"
          >
            {snoozeMutation.isPending ? (
              <ActivityIndicator color={DARK.primary} size="small" />
            ) : (
              <Text style={styles.snoozeConfirmText}>Adiar</Text>
            )}
          </TouchableOpacity>
        </View>

        {showSkipReason ? (
          <View style={styles.skipReasonContainer}>
            <TextInput
              style={styles.skipInput}
              placeholder="Motivo (opcional)..."
              placeholderTextColor={DARK.sub}
              value={skipReason}
              onChangeText={setSkipReason}
              autoFocus
            />
            <View style={styles.skipBtnRow}>
              <TouchableOpacity
                style={styles.skipCancelBtn}
                onPress={() => setShowSkipReason(false)}
              >
                <Text style={styles.skipCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.skipConfirmBtn, isPending && styles.btnDisabled]}
                onPress={handleSkip}
                disabled={isPending}
              >
                {skipMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.skipConfirmText}>Confirmar pulo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.skipBtn, isPending && styles.btnDisabled]}
            onPress={handleSkip}
            disabled={isPending}
            accessibilityLabel="Pular dose"
            accessibilityHint="Toque para registrar que esta dose foi pulada"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle-outline" size={20} color={DARK.sub} />
            <Text style={styles.skipBtnText}>Pular dose</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
