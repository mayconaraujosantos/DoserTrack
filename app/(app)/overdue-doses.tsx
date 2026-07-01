import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { getDosesForDate } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import type { Dose } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function OverdueScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const dbReady = useAppStore(s => s.dbReady);

  const [overdueDoses, setOverdueDoses] = useState<Dose[]>([]);

  const { data: todayDoses, isLoading } = useQuery({
    queryKey: ['doses', 'today'],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      return getDosesForDate(today);
    },
    enabled: dbReady,
  });

  useEffect(() => {
    if (!todayDoses) return;
    const now = new Date();
    const overdue = todayDoses.filter(d => {
      const scheduled = new Date(d.scheduledTime);
      return scheduled < now && d.status !== 'taken' && d.status !== 'skipped';
    });
    setOverdueDoses(overdue);
  }, [todayDoses]);

  function handleDosePress(doseId: number) {
    router.push({
      pathname: '/reminder-alert',
      params: { doseId: String(doseId) },
    });
  }

  function handleClose() {
    qc.invalidateQueries({ queryKey: ['doses'] });
    router.back();
  }

  const minutesLate = (dose: Dose) => {
    const scheduled = new Date(dose.scheduledTime);
    const now = new Date();
    return Math.floor((now.getTime() - scheduled.getTime()) / 60_000);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: C.bg }]}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (overdueDoses.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: C.bg, justifyContent: 'center' }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={56} color={C.success} />
          <Text variant="title" color={C.text} style={styles.emptyTitle}>
            Nenhuma dose atrasada
          </Text>
          <Text variant="body" color={C.sub} style={styles.emptyText}>
            Todas as doses foram registradas!
          </Text>
          <Button variant="primary" size="lg" onPress={handleClose} style={styles.closeBtn}>
            Fechar
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="chevron-back" size={28} color={C.text} />
        </TouchableOpacity>
        <Text variant="title" color={C.text}>
          Doses Atrasadas
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <Text variant="body" color={C.sub} style={styles.subtitle}>
          Você tem {overdueDoses.length} dose{overdueDoses.length > 1 ? 's' : ''} que precisa
          registrar
        </Text>

        <FlatList
          data={overdueDoses}
          scrollEnabled={false}
          keyExtractor={d => String(d.id)}
          renderItem={({ item: dose }) => (
            <Card
              variant="outlined"
              style={[styles.doseCard, { borderColor: C.danger, backgroundColor: C.danger + '10' }]}
            >
              <View style={styles.doseHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="title" color={C.text}>
                    {dose.medicineName}
                  </Text>
                  {dose.dosage && (
                    <Text variant="body" color={C.sub} style={styles.dosage}>
                      {dose.dosage}
                    </Text>
                  )}
                </View>
                <View style={[styles.lateBadge, { backgroundColor: C.danger }]}>
                  <Text variant="caption" color="#fff" style={{ fontWeight: '700' }}>
                    {minutesLate(dose)}min
                  </Text>
                </View>
              </View>

              <View style={styles.timeInfo}>
                <Ionicons name="time-outline" size={14} color={C.danger} />
                <Text variant="caption" color={C.danger}>
                  Programado: {formatDateTime(dose.scheduledTime)}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.takeBtn, { backgroundColor: C.danger }]}
                onPress={() => handleDosePress(dose.id)}
              >
                <Ionicons name="medical" size={18} color="#fff" />
                <Text style={styles.takeBtnText}>Registrar agora</Text>
              </TouchableOpacity>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  content: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  subtitle: { marginBottom: 16, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { marginTop: 12 },
  emptyText: { textAlign: 'center', marginBottom: 20 },
  closeBtn: { marginTop: 20 },
  doseCard: { gap: 12, paddingBottom: 12 },
  doseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dosage: { marginTop: 4 },
  lateBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  takeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  takeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
