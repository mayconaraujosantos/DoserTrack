import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDoseById, updateDoseStatus } from '@/lib/database';
import { scheduleSnoozeNotification, cancelNotification } from '@/lib/notifications';
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

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: DARK.bg, padding: 32, justifyContent: 'center' },
    center: { alignItems: 'center' },
    iconOuter: {
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: 'rgba(91,159,230,0.15)', alignItems: 'center', justifyContent: 'center',
      alignSelf: 'center', marginBottom: 32,
    },
    iconInner: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: 'rgba(91,159,230,0.25)', alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 28, fontWeight: '800', color: DARK.text, textAlign: 'center', marginBottom: 8 },
    medicineName: { fontSize: 22, fontWeight: '700', color: DARK.text, textAlign: 'center' },
    dosage: { fontSize: 16, color: DARK.sub, textAlign: 'center', marginTop: 4 },
    timeBox: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, marginTop: 16, marginBottom: 40,
    },
    timeText: { fontSize: 14, color: DARK.sub },
    actions: { gap: 12 },
    takeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 10, backgroundColor: DARK.success, height: 60, borderRadius: 18,
    },
    takeBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
    snoozeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 10, height: 54, borderRadius: 18, borderWidth: 1.5,
      borderColor: 'rgba(91,159,230,0.4)', backgroundColor: 'rgba(91,159,230,0.12)',
    },
    snoozeBtnText: { fontSize: 16, fontWeight: '600', color: DARK.primary },
    skipBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 48, borderRadius: 18,
    },
    skipBtnText: { fontSize: 15, color: DARK.sub },
    btnDisabled: { opacity: 0.5 },
    skipReasonContainer: { gap: 10 },
    skipInput: {
      backgroundColor: DARK.card, borderRadius: 12, paddingHorizontal: 14, height: 48,
      fontSize: 15, color: DARK.text, borderWidth: 1, borderColor: DARK.border,
    },
    skipBtnRow: { flexDirection: 'row', gap: 10 },
    skipCancelBtn: {
      flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: DARK.border,
    },
    skipCancelText: { color: DARK.sub, fontWeight: '600' },
    skipConfirmBtn: {
      flex: 2, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
      backgroundColor: DARK.danger,
    },
    skipConfirmText: { color: '#fff', fontWeight: '700' },
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function ReminderAlertScreen() {
  const { doseId } = useLocalSearchParams<{ doseId: string }>();
  const [showSkipReason, setShowSkipReason] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const dbReady = useAppStore((s) => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();
  const styles = useMemo(makeStyles, []);

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
      qc.invalidateQueries({ queryKey: ['doses'] });
      router.back();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async () => {
      if (dose?.notificationId) await cancelNotification(dose.notificationId);
      await updateDoseStatus(id, 'snoozed');
      if (dose) {
        await scheduleSnoozeNotification({
          id: dose.id,
          medicineName: dose.medicineName ?? '',
          dosage: dose.dosage ?? '',
        });
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
    if (!showSkipReason) { setShowSkipReason(true); return; }
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
          <Ionicons name="medical" size={40} color={DARK.primary} />
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
        >
          {takeMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.takeBtnText}>Tomar agora</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.snoozeBtn, isPending && styles.btnDisabled]}
          onPress={() => snoozeMutation.mutate()}
          disabled={isPending}
        >
          {snoozeMutation.isPending ? (
            <ActivityIndicator color={DARK.primary} />
          ) : (
            <>
              <Ionicons name="alarm-outline" size={20} color={DARK.primary} />
              <Text style={styles.snoozeBtnText}>Soneca (10 min)</Text>
            </>
          )}
        </TouchableOpacity>

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
              <TouchableOpacity style={styles.skipCancelBtn} onPress={() => setShowSkipReason(false)}>
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
          >
            <Ionicons name="close-circle-outline" size={20} color={DARK.sub} />
            <Text style={styles.skipBtnText}>Pular dose</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
