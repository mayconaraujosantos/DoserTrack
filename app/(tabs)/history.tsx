import { useCallback, useMemo, useState } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { getWeekAdherence, getRecentHistory } from '@/lib/database';
import { generateAdherenceReport } from '@/lib/report';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
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

function barColorForPct(
  pct: number,
  success: string,
  warning: string,
  danger: string,
  border: string
): string {
  if (pct === 0) return border;
  if (pct >= 0.8) return success;
  if (pct >= 0.5) return warning;
  return danger;
}

function doseStatusBadgeVariant(status: Dose['status']): BadgeVariant {
  if (status === 'taken') return 'success';
  if (status === 'skipped') return 'danger';
  if (status === 'snoozed') return 'warning';
  return 'neutral';
}

function doseStatusLabel(status: Dose['status']): string {
  if (status === 'taken') return 'Tomado';
  if (status === 'skipped') return 'Pulado';
  if (status === 'snoozed') return 'Soneca';
  return 'Pendente';
}

function sectionDateLabel(dateStr: string): string {
  const todayKey = new Date().toISOString().split('T')[0];
  const yesterdayKey = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  if (dateStr === todayKey) return 'Hoje';
  if (dateStr === yesterdayKey) return 'Ontem';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ─── AdherenceBar ─────────────────────────────────────────────────────────────

function AdherenceBar({ pct, color }: Readonly<{ pct: number; color: string }>) {
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { height: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    width: 20,
    height: 60,
    backgroundColor: '#00000010',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: { width: '100%', borderRadius: 10, minHeight: 4 },
});

// ─── HistoryItem ──────────────────────────────────────────────────────────────

function HistoryItem({ item }: Readonly<{ item: Dose }>) {
  const C = useTheme();
  const STATUS_COLORS: Record<string, string> = {
    taken: C.success,
    skipped: C.danger,
    snoozed: C.warning,
    pending: C.sub,
  };
  const dotColor = STATUS_COLORS[item.status] ?? C.sub;

  return (
    <TouchableOpacity
      style={[styles.historyRow, { backgroundColor: C.card }]}
      activeOpacity={0.75}
      accessibilityLabel={`${item.medicineName}, ${doseStatusLabel(item.status)}, ${formatTime(item.scheduledTime)}`}
    >
      <View style={[styles.statusBar, { backgroundColor: dotColor }]} />

      <View style={styles.historyInfo}>
        <Text variant="title" numberOfLines={1}>
          {item.medicineName}
        </Text>
        {item.dosage ? (
          <Text variant="caption" color={C.sub}>
            {item.dosage}
          </Text>
        ) : null}
        <View style={styles.historyTimes}>
          <Ionicons name="time-outline" size={11} color={C.sub} />
          <Text variant="caption" color={C.sub}>
            {formatTime(item.scheduledTime)}
          </Text>
          {item.takenTime && (
            <>
              <Ionicons name="arrow-forward" size={11} color={C.success} />
              <Text variant="caption" color={C.success}>
                {formatTime(item.takenTime)}
              </Text>
            </>
          )}
        </View>
      </View>

      <Badge variant={doseStatusBadgeVariant(item.status)} label={doseStatusLabel(item.status)} />
    </TouchableOpacity>
  );
}

// ─── HistoryScreen ────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const dbReady = useAppStore(s => s.dbReady);
  const [exporting, setExporting] = useState(false);

  const { data: adherence = [], isLoading: loadingAdherence } = useQuery({
    queryKey: ['adherence'],
    queryFn: getWeekAdherence,
    enabled: dbReady,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['history'],
    queryFn: () => getRecentHistory(),
    enabled: dbReady,
  });

  const last7 = getLast7Days();
  const adherenceMap = new Map(adherence.map(a => [a.date, a]));
  const totalTaken = adherence.reduce((s, a) => s + a.taken, 0);
  const totalDoses = adherence.reduce((s, a) => s + a.total, 0);
  const overallPct = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;
  const todayKey = new Date().toISOString().split('T')[0];

  // Group history by date (descending)
  const sections = useMemo(() => {
    if (history.length === 0) return [];
    const map = new Map<string, Dose[]>();
    for (const d of history) {
      const dateKey = d.scheduledTime.split('T')[0];
      const arr = map.get(dateKey);
      if (arr) arr.push(d);
      else map.set(dateKey, [d]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({ title: sectionDateLabel(date), data }));
  }, [history]);

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Dose>) => <HistoryItem item={item} />,
    []
  );

  const renderSectionHeader = useCallback(
     
    ({ section }: { section: any }) => (
      <View style={[styles.sectionHeader, { backgroundColor: C.bg }]}>
        <Text variant="caption" color={C.sub} style={styles.sectionLabel}>
          {section.title as string}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: C.border }]} />
      </View>
    ),
    [C]
  );

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
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error(error);
      Alert.alert('Erro ao exportar', 'Não foi possível gerar o PDF.');
    } finally {
      setExporting(false);
    }
  }, []);

  const ListHeader = (
    <View style={styles.listHeader}>
      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <View style={[styles.summaryCard, { backgroundColor: C.primary }]}>
        <View style={styles.summaryMain}>
          <Text variant="heading" color="#fff" style={styles.summaryPct}>
            {overallPct}%
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.65)">
            de adesão nos últimos 7 dias
          </Text>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text variant="title" color="#fff">
              {totalTaken}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.65)">
              tomadas
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={styles.statItem}>
            <Text variant="title" color="#fff">
              {totalDoses - totalTaken}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.65)">
              perdidas
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={styles.statItem}>
            <Text variant="title" color="#fff">
              {totalDoses}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.65)">
              total
            </Text>
          </View>
        </View>
      </View>

      {/* ── Week chart ───────────────────────────────────────────────────── */}
      <Card variant="default" style={styles.chartCard}>
        <Text variant="label" style={styles.chartTitle}>
          Adesão por dia
        </Text>
        {loadingAdherence ? (
          <View style={styles.chartRow}>
            {[1, 2, 3, 4, 5, 6, 7].map(k => (
              <View key={k} style={[styles.barCol, { gap: 6 }]}>
                <Skeleton width={20} height={60} borderRadius={10} />
                <Skeleton width={20} height={10} borderRadius={5} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.chartRow}>
            {last7.map(dateStr => {
              const row = adherenceMap.get(dateStr);
              const pct = row && row.total > 0 ? row.taken / row.total : 0;
              const color = barColorForPct(pct, C.success, C.warning, C.danger, C.border);
              const dow = new Date(`${dateStr}T12:00:00`).getDay();
              const isToday = dateStr === todayKey;
              return (
                <View key={dateStr} style={styles.barCol}>
                  <AdherenceBar pct={pct} color={color} />
                  <Text
                    variant="caption"
                    color={isToday ? C.primary : C.sub}
                    style={isToday ? styles.barLabelToday : undefined}
                  >
                    {DAYS_SHORT[dow]}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.legend}>
          {[
            { color: C.success, label: '≥80%' },
            { color: C.warning, label: '50–79%' },
            { color: C.danger, label: '<50%' },
          ].map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text variant="caption" color={C.sub}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: C.card, borderBottomColor: C.border },
        ]}
      >
        <Text variant="heading">Histórico</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Exportar PDF"
          activeOpacity={0.8}
          disabled={exporting || loadingHistory || loadingAdherence}
          onPress={handleExportPdf}
          style={[
            styles.exportBtn,
            { backgroundColor: C.primary },
            (exporting || loadingHistory || loadingAdherence) && { opacity: 0.6 },
          ]}
        >
          <Ionicons
            name={exporting ? 'hourglass-outline' : 'download-outline'}
            size={16}
            color="#fff"
          />
          <Text variant="label" color="#fff">
            {exporting ? 'Gerando...' : 'Exportar PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: C.border }]} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loadingHistory ? (
            <View style={styles.skeletonWrap}>
              {[1, 2, 3].map(k => (
                <Skeleton key={k} width="100%" height={68} borderRadius={12} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: C.card }]}>
                <Ionicons name="time-outline" size={36} color={C.sub} />
              </View>
              <Text variant="title">Sem registros</Text>
              <Text variant="body" color={C.sub} style={styles.emptyDesc}>
                O histórico de doses aparecerá aqui conforme você registrar os medicamentos.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  // List
  listContent: { paddingBottom: 100 },
  listHeader: { padding: 16, gap: 12 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionLabel: { fontWeight: '600', textTransform: 'capitalize' },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },

  // Separator
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 68 },

  // Summary card
  summaryCard: {
    borderRadius: 18,
    padding: 20,
    gap: 16,
  },
  summaryMain: { gap: 2 },
  summaryPct: { fontSize: 48, fontWeight: '800', lineHeight: 50 },
  summaryStats: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 32 },

  // Chart
  chartCard: { gap: 0 },
  chartTitle: { marginBottom: 16 },
  chartRow: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barLabelToday: { fontWeight: '700' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // History row
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statusBar: { width: 3, height: 36, borderRadius: 2, marginRight: 12 },
  historyInfo: { flex: 1, gap: 2 },
  historyTimes: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  // Skeleton / Empty
  skeletonWrap: { padding: 16, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 12 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDesc: { textAlign: 'center', lineHeight: 21 },
});
