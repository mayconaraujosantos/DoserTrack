import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Image,
  StyleSheet, Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getMedicines, deleteMedicine } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
import { MedicineCardSkeleton } from '@/components/ui/skeleton';
import type { Medicine, MedicineType } from '@/types';

const TYPE_ICONS: Record<MedicineType, string> = {
  capsule: 'ellipse',
  tablet: 'square',
  drop: 'water',
  ml: 'flask',
  injection: 'fitness',
  other: 'medical',
};

const TYPE_LABELS: Record<MedicineType, string> = {
  capsule: 'Cápsula',
  tablet: 'Comprimido',
  drop: 'Gota',
  ml: 'mL',
  injection: 'Injeção',
  other: 'Outro',
};

function stockColor(medicine: Medicine, C: ThemeColors): string {
  if (medicine.stockQuantity <= 0) return C.danger;
  if (medicine.stockQuantity <= medicine.lowStockThreshold) return C.warning;
  return C.success;
}

function stockNote(medicine: Medicine): string {
  if (medicine.stockQuantity <= 0) return ' — Sem estoque';
  if (medicine.stockQuantity <= medicine.lowStockThreshold) return ' — Estoque baixo';
  return '';
}

function MedicineCard({ medicine, onDelete, onSchedule, onEdit }: Readonly<{
  medicine: Medicine;
  onDelete: (id: number) => void;
  onSchedule: (id: number) => void;
  onEdit: (id: number) => void;
}>) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const color = stockColor(medicine, C);
  const iconName = TYPE_ICONS[medicine.type];

  return (
    <View style={styles.card}>
      {medicine.photoUri ? (
        <Image source={{ uri: medicine.photoUri }} style={styles.photo} />
      ) : (
        <View style={[styles.iconBox, { backgroundColor: C.primary + '18' }]}>
          <Ionicons name={iconName as never} size={26} color={C.primary} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.medicineName}>{medicine.name}</Text>
        <Text style={styles.medicineType}>{TYPE_LABELS[medicine.type]}</Text>
        <View style={styles.stockRow}>
          <View style={[styles.stockDot, { backgroundColor: color }]} />
          <Text style={[styles.stockText, { color }]}>
            {medicine.stockQuantity} {medicine.stockUnit}{stockNote(medicine)}
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(medicine.id)}>
          <Ionicons name="pencil-outline" size={17} color={C.sub} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.scheduleBtn} onPress={() => onSchedule(medicine.id)}>
          <Ionicons name="alarm-outline" size={17} color={C.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(medicine.id)}>
          <Ionicons name="trash-outline" size={17} color={C.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MedicinesScreen() {
  const [search, setSearch] = useState('');
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const dbReady = useAppStore((s) => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['medicines'],
    queryFn: getMedicines,
    enabled: dbReady,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMedicine,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medicines'] }),
  });

  const confirmDelete = useCallback((id: number) => {
    Alert.alert(
      'Excluir medicamento',
      'Isso também removerá todos os horários e doses. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]
    );
  }, [deleteMutation]);

  const filtered = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Medicine>) => (
      <MedicineCard
        medicine={item}
        onEdit={(id) => router.push(`/edit-medicine?id=${id}` as never)}
        onSchedule={(id) => router.push(`/add-schedule?medicineId=${id}` as never)}
        onDelete={confirmDelete}
      />
    ),
    [confirmDelete, router]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Remédios</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-medicine' as never)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={C.sub} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar medicamento..."
          placeholderTextColor={C.sub}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading && (
        <View style={styles.list}>
          {[1, 2, 3].map((k) => <MedicineCardSkeleton key={k} />)}
        </View>
      )}
      {!isLoading && filtered.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="medkit-outline" size={56} color={C.border} />
          <Text style={styles.emptyText}>
            {search ? 'Nenhum resultado' : 'Nenhum medicamento cadastrado'}
          </Text>
          {!search && (
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/add-medicine' as never)}
            >
              <Text style={styles.emptyBtnText}>Adicionar medicamento</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {!isLoading && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: C.card, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: C.text },
    addBtn: {
      backgroundColor: C.primary, width: 42, height: 42,
      borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
      marginHorizontal: 16, marginVertical: 12, borderRadius: 12,
      paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 44, color: C.text, fontSize: 15 },
    list: { padding: 16, gap: 10 },
    loader: { flex: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 16, color: C.sub },
    emptyBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    card: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
      borderRadius: 14, padding: 14, elevation: 2,
      shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    iconBox: {
      width: 48, height: 48, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    photo: {
      width: 48, height: 48, borderRadius: 12, marginRight: 12,
    },
    cardInfo: { flex: 1 },
    medicineName: { fontSize: 16, fontWeight: '700', color: C.text },
    medicineType: { fontSize: 13, color: C.sub, marginTop: 1 },
    stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
    stockDot: { width: 7, height: 7, borderRadius: 4 },
    stockText: { fontSize: 12, fontWeight: '500' },
    cardActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
    editBtn: {
      width: 34, height: 34, borderRadius: 10, backgroundColor: C.sub + '18',
      alignItems: 'center', justifyContent: 'center',
    },
    scheduleBtn: {
      width: 34, height: 34, borderRadius: 10, backgroundColor: C.primary + '18',
      alignItems: 'center', justifyContent: 'center',
    },
    deleteBtn: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: C.danger + '18',
      alignItems: 'center', justifyContent: 'center',
    },
  });
}
