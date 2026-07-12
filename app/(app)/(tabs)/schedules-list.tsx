import { Card } from '@/components/ui/card/Card';
import { ScreenHeader, headerBtnStyle } from '@/components/ui/header/ScreenHeader';
import { Text } from '@/components/ui/text/Text';
import { useSchedules } from '@/hooks/use-schedules';
import { useTheme } from '@/hooks/use-theme';
import { describeFrequency } from '@/lib/frequency-strategy';
import type { Schedule } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

function ScheduleRow({ item, onPress }: Readonly<{ item: Schedule; onPress: () => void }>) {
  const C = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={`Editar agendamento de ${item.medicineName}`}
      accessibilityRole="button"
    >
      <Card variant="flat" style={styles.row}>
        <View style={styles.rowInfo}>
          <Text variant="body" style={styles.medName}>
            {item.medicineName}
          </Text>
          <Text variant="caption" color={C.sub}>
            {item.dosage} • {describeFrequency(item.frequencyConfig)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.sub} />
      </Card>
    </TouchableOpacity>
  );
}

export default function SchedulesListScreen() {
  const C = useTheme();
  const router = useRouter();
  const { data: schedules = [], isLoading } = useSchedules();

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <ScreenHeader
        title="Meus Agendamentos"
        right={
          <TouchableOpacity
            style={headerBtnStyle.iconOnly}
            onPress={() => router.push('/add-schedule')}
            accessibilityLabel="Adicionar agendamento"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        }
      />

      {isLoading && <ActivityIndicator style={styles.loader} color={C.primary} />}

      {!isLoading && schedules.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="alarm-outline" size={32} color={C.sub} />
          <Text variant="body" color={C.sub} style={styles.emptyText}>
            Nenhum agendamento ativo
          </Text>
        </View>
      )}

      {!isLoading && schedules.length > 0 && (
        <FlatList
          data={schedules}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ScheduleRow
              item={item}
              onPress={() => router.push(`/edit-schedule?id=${item.id}` as never)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyText: { textAlign: 'center' },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowInfo: { flex: 1, gap: 2 },
  medName: { fontWeight: '600' },
});
