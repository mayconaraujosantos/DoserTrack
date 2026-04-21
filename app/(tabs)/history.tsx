import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { getWeeklyAdherence, getRecentHistory } from '@/lib/database';
import { generateAdherenceReport } from '@/lib/report';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import { Skeleton } from '@/components/ui/skeleton';
import type { Dose } from '@/types';

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function barColor(pct: number, C: ThemeColors): string {
  if (pct === 0) return C.border;
  if (pct >= 0.8) return C.success;
  if (pct >= 0.5) return C.warning;
  return C.danger;
}

function doseStatusInfo(dose: Dose, C: ThemeColors): { label: string; color: string } {
  if (dose.status === 'taken') return { label: 'Tomado', color: C.success };
  if (dose.status === 'skipped') return { label: 'Pulado', color: C.danger };
  if (dose.status === 'snoozed') return { label: 'Soneca', color: C.warning };
  return { label: 'Pendente', color: C.sub };
}

function AdherenceBar({ pct, color }: Readonly<{ pct: number; color: string }>) {
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { height: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: { width: 20, height: 60, backgroundColor: '#00000010', borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { width: '100%', borderRadius: 10, minHeight: 4 },
});

function HistoryItem({ item }: Readonly<{ item: Dose }>) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { label, color } = doseStatusInfo(item, C);

  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyDot, { backgroundColor: color }]} />
      <View style={styles.historyInfo}>
        <Text style={styles.historyName}>{item.medicineName}</Text>
        <Text style={styles.historyDosage}>{item.dosage}</Text>
        <View style={styles.historyTimes}>
          <Text style={styles.historyTimeLabel}>
            Programado: {formatTime(item.scheduledTime)}
          </Text>
          {item.takenTime && (
            <Text style={[styles.historyTimeLabel, { color: C.success }]}>
              {'  '}Tomado: {formatTime(item.takenTime)}
            </Text>
          )}
        </View>
      </View>
      <View>
        <Text style={styles.historyDate}>
          {new Date(item.scheduledTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const dbReady = useAppStore((s) => s.dbReady);
  const [exporting, setExporting] = useState(false);

  const { data: adherence = [], isLoading: loadingAdherence } = useQuery({
    queryKey: ['adherence'],
    queryFn: getWeeklyAdherence,
    enabled: dbReady,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['history'],
    queryFn: () => getRecentHistory(),
    enabled: dbReady,
  });

  const last7 = getLast7Days();
  const adherenceMap = new Map(adherence.map((a) => [a.date, a]));
  const totalTaken = adherence.reduce((s, a) => s + a.taken, 0);
  const totalDoses = adherence.reduce((s, a) => s + a.total, 0);
  const overallPct = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Dose>) => <HistoryItem item={item} />,
    []
  );

  const todayStr = new Date().toISOString().split('T')[0];

  const handleExportPdf = useCallback(async () => {
    try {
      setExporting(true);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 29);

      const html = await generateAdherenceReport({
        profileName: 'Perfil padrão',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert('PDF gerado', `Arquivo salvo em:\n${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Erro ao exportar', 'Nao foi possivel gerar o PDF agora.');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Histórico</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Exportar histórico em PDF"
            activeOpacity={0.8}
            disabled={exporting || loadingHistory || loadingAdherence}
            onPress={handleExportPdf}
            style={[
              styles.exportButton,
              (exporting || loadingHistory || loadingAdherence) && styles.exportButtonDisabled,
            ]}>
            <Ionicons name={exporting ? "hourglass-outline" : "download-outline"} size={16} color="#fff" />
            <Text style={styles.exportButtonText}>
              {exporting ? 'Gerando...' : 'PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryPct}>{overallPct}%</Text>
                <Text style={styles.summaryLabel}>Adesão (7 dias)</Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={styles.summaryDetail}>{totalTaken} tomadas</Text>
                <Text style={styles.summaryDetail}>{totalDoses - totalTaken} perdidas</Text>
                <Text style={styles.summaryDetail}>{totalDoses} total</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Adesão da Semana</Text>
              {loadingAdherence ? (
                <View style={styles.chartRow}>
                  {[1,2,3,4,5,6,7].map((k) => (
                    <View key={k} style={[styles.barCol, { gap: 6 }]}>
                      <Skeleton width={20} height={60} borderRadius={10} />
                      <Skeleton width={20} height={10} borderRadius={5} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.chartRow}>
                  {last7.map((dateStr) => {
                    const row = adherenceMap.get(dateStr);
                    const pct = row && row.total > 0 ? row.taken / row.total : 0;
                    const color = barColor(pct, C);
                    const dow = new Date(dateStr + 'T12:00:00').getDay();
                    const isToday = dateStr === todayStr;
                    return (
                      <View key={dateStr} style={styles.barCol}>
                        <AdherenceBar pct={pct} color={color} />
                        <Text style={[styles.barLabel, isToday && { color: C.primary, fontWeight: '700' }]}>
                          {DAYS_SHORT[dow]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Registros Recentes</Text>
          </View>
        }
        ListEmptyComponent={
          loadingHistory ? (
            <View style={{ padding: 16, gap: 10 }}>
              {[1,2,3].map((k) => <Skeleton key={k} width="100%" height={68} borderRadius={12} />)}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum registro ainda</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      backgroundColor: C.card, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: C.text },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primary,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    exportButtonDisabled: {
      opacity: 0.6,
    },
    exportButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    listContent: { padding: 16, gap: 10 },
    summaryCard: {
      flexDirection: 'row', backgroundColor: C.primary, borderRadius: 16,
      padding: 20, marginBottom: 12, alignItems: 'center',
    },
    summaryLeft: { flex: 1 },
    summaryPct: { fontSize: 48, fontWeight: '800', color: '#fff' },
    summaryLabel: { fontSize: 14, color: '#ffffff99', marginTop: 2 },
    summaryRight: { gap: 4, alignItems: 'flex-end' },
    summaryDetail: { fontSize: 13, color: '#ffffffcc' },
    chartCard: {
      backgroundColor: C.card, borderRadius: 16, padding: 16,
      marginBottom: 12, elevation: 2,
      shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    chartTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 16 },
    chartRow: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 4 },
    barCol: { flex: 1, alignItems: 'center', gap: 6 },
    barLabel: { fontSize: 10, color: C.sub },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
    historyItem: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
      borderRadius: 12, padding: 12, gap: 10, elevation: 1,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    },
    historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 2, flexShrink: 0 },
    historyInfo: { flex: 1 },
    historyName: { fontSize: 14, fontWeight: '600', color: C.text },
    historyDosage: { fontSize: 12, color: C.sub },
    historyTimes: { flexDirection: 'row', marginTop: 3 },
    historyTimeLabel: { fontSize: 11, color: C.sub },
    historyDate: { fontSize: 11, color: C.sub, textAlign: 'right' },
    statusBadge: { marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 24 },
    emptyText: { fontSize: 15, color: C.sub },
  });
}
