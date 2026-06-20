import { MedicineCardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/Button';

import { ScreenHeader, headerBtnStyle } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { deleteMedicine, getMedicines } from '@/lib/database';
import { haptic } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { Medicine, MedicineType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  SectionList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type SectionListRenderItemInfo,
} from 'react-native';

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

function resolveStockColor(medicine: Medicine, C: ReturnType<typeof useTheme>): string {
  if (medicine.stockQuantity <= 0) return C.danger;
  if (medicine.stockQuantity <= medicine.lowStockThreshold) return C.warning;
  return C.success;
}

// ─── MedicineRow ──────────────────────────────────────────────────────────────

function MedicineRow({
  medicine,
  onDelete,
  onSchedule,
  onEdit,
  selectionMode,
  selected,
  onLongPress,
  onSelect,
}: Readonly<{
  medicine: Medicine;
  onDelete: (id: number) => void;
  onSchedule: (id: number) => void;
  onEdit: (id: number) => void;
  selectionMode: boolean;
  selected: boolean;
  onLongPress: (id: number) => void;
  onSelect: (id: number) => void;
}>) {
  const C = useTheme();
  const color = resolveStockColor(medicine, C);

  function handlePress() {
    if (selectionMode) onSelect(medicine.id);
    else onEdit(medicine.id);
  }

  function showMenu() {
    Alert.alert(medicine.name, undefined, [
      { text: 'Editar', onPress: () => onEdit(medicine.id) },
      { text: 'Agendar alarmes', onPress: () => onSchedule(medicine.id) },
      { text: 'Excluir', style: 'destructive', onPress: () => onDelete(medicine.id) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: C.card },
        selected && { backgroundColor: C.primary + '0C', borderColor: C.primary, borderWidth: 1.5 },
      ]}
      onPress={handlePress}
      onLongPress={() => onLongPress(medicine.id)}
      delayLongPress={400}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`${medicine.name}${selected ? ', selecionado' : ''}`}
      accessibilityState={{ selected }}
    >
      {selectionMode && (
        <View
          style={[
            styles.checkbox,
            selected && { backgroundColor: C.primary, borderColor: C.primary },
          ]}
        >
          {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
      )}

      <View style={[styles.iconWrap, { backgroundColor: C.primary + '12' }]}>
        {medicine.photoUri ? (
          <Image source={{ uri: medicine.photoUri }} style={styles.iconPhoto} />
        ) : (
          <Ionicons name={TYPE_ICONS[medicine.type] as never} size={22} color={C.primary} />
        )}
      </View>

      <View style={styles.rowInfo}>
        <Text variant="title" numberOfLines={1}>
          {medicine.name}
        </Text>
        <Text variant="caption" color={C.sub}>
          {TYPE_LABELS[medicine.type]}
        </Text>
      </View>

      {!selectionMode && (
        <>
          <View style={[styles.stockChip, { backgroundColor: color + '18' }]}>
            <View style={[styles.stockDot, { backgroundColor: color }]} />
            <Text variant="label" color={color}>
              {medicine.stockQuantity} {medicine.stockUnit}
            </Text>
          </View>
          <TouchableOpacity
            onPress={showMenu}
            style={styles.menuBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 4 }}
            accessibilityLabel={`Menu de opções para ${medicine.name}`}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={C.sub} />
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MedicinesScreen() {
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const C = useTheme();
  const dbReady = useAppStore(s => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['medicines'],
    queryFn: getMedicines,
    enabled: dbReady,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMedicine,
    onSuccess: () => {
      haptic.warning();
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['doses'] });
      qc.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  // ── Selection ─────────────────────────────────────────────────────────────

  function enterSelectionMode(id: number) {
    haptic.warning();
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  const filtered = useMemo(
    () => medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase())),
    [medicines, search]
  );

  const allSelected = filtered.length > 0 && filtered.every(m => selectedIds.has(m.id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(m => m.id)));
  }

  // ── Sections (alphabetical) ───────────────────────────────────────────────

  const sections = useMemo(() => {
    if (filtered.length === 0) return [];
    const sorted = [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
    const map = new Map<string, Medicine[]>();
    for (const m of sorted) {
      const letter = m.name[0]?.toUpperCase() ?? '#';
      const arr = map.get(letter);
      if (arr) arr.push(m);
      else map.set(letter, [m]);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = useCallback(
    (id: number) => {
      Alert.alert(
        'Excluir medicamento',
        'Isso também removerá todos os horários e doses. Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
        ]
      );
    },
    [deleteMutation]
  );

  function confirmDeleteSelected() {
    const count = selectedIds.size;
    Alert.alert(
      `Excluir ${count} medicamento${count > 1 ? 's' : ''}`,
      `Também removerá horários e doses. Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) await deleteMutation.mutateAsync(id);
            exitSelectionMode();
          },
        },
      ]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Medicine>) => (
      <MedicineRow
        medicine={item}
        onEdit={id => router.push(`/edit-medicine?id=${id}` as never)}
        onSchedule={id => router.push(`/add-schedule?medicineId=${id}` as never)}
        onDelete={confirmDelete}
        selectionMode={selectionMode}
        selected={selectedIds.has(item.id)}
        onLongPress={enterSelectionMode}
        onSelect={toggleSelect}
      />
    ),
    [confirmDelete, router, selectionMode, selectedIds]
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }: { section: { title: string; data: readonly Medicine[] } }) => (
      <View style={[styles.sectionHeader, { backgroundColor: C.bg }]}>
        <Text variant="caption" color={C.sub} style={styles.sectionLetter}>
          {title}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: C.border }]} />
      </View>
    ),
    [C]
  );

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {selectionMode ? (
        <ScreenHeader
          title={`${selectedIds.size} selecionado${selectedIds.size !== 1 ? 's' : ''}`}
          left={
            <TouchableOpacity
              style={headerBtnStyle.iconOnly}
              onPress={exitSelectionMode}
              accessibilityLabel="Cancelar seleção"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          }
          right={
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={toggleSelectAll}
                style={headerBtnStyle.btn}
                accessibilityLabel={allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={allSelected ? 'checkbox' : 'checkbox-outline'}
                  size={16}
                  color="#fff"
                />
                <Text variant="label" color="#fff">
                  {allSelected ? 'Desmarcar' : 'Todos'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteSelected}
                style={[headerBtnStyle.btn, { backgroundColor: 'rgba(231,76,60,0.8)' }]}
                disabled={selectedIds.size === 0}
                accessibilityLabel="Excluir selecionados"
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={14} color="#fff" />
                <Text variant="label" color="#fff">
                  Excluir
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <ScreenHeader
          title="Remédios"
          subtitle={
            medicines.length > 0
              ? `${medicines.length} cadastrado${medicines.length !== 1 ? 's' : ''}`
              : undefined
          }
          right={
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={headerBtnStyle.iconOnly}
                onPress={() =>
                  Alert.alert('Escanear com IA', 'O que você quer fotografar?', [
                    {
                      text: 'Embalagem do remédio',
                      onPress: () => router.push('/scan-medicine' as never),
                    },
                    {
                      text: 'Receita médica',
                      onPress: () => router.push('/scan-prescription' as never),
                    },
                    { text: 'Cancelar', style: 'cancel' },
                  ])
                }
                accessibilityLabel="Escanear com IA"
                accessibilityRole="button"
              >
                <Ionicons name="scan-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={headerBtnStyle.iconOnly}
                onPress={() => router.push('/add-medicine' as never)}
                accessibilityLabel="Adicionar medicamento"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      {!selectionMode && (
        <View style={[styles.searchWrap, { backgroundColor: C.bg }]}>
          <View style={[styles.searchBox, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="search-outline" size={17} color={C.sub} />
            <TextInput
              style={[styles.searchInput, { color: C.text }]}
              placeholder="Buscar medicamento..."
              placeholderTextColor={C.sub}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Limpar busca">
                <Ionicons name="close-circle" size={17} color={C.sub} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Selection hint ──────────────────────────────────────────────────── */}
      {!selectionMode && medicines.length > 0 && (
        <Text variant="caption" color={C.sub} style={styles.hint}>
          Pressione e segure para selecionar múltiplos
        </Text>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isLoading && (
        <View style={styles.skeletonWrap}>
          {[1, 2, 3].map(k => (
            <MedicineCardSkeleton key={k} />
          ))}
        </View>
      )}

      {/* ── Empty ───────────────────────────────────────────────────────────── */}
      {!isLoading && filtered.length === 0 && (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: C.card }]}>
            <Ionicons name="medkit-outline" size={40} color={C.sub} />
          </View>
          <Text variant="title">{search ? 'Sem resultados' : 'Nenhum medicamento'}</Text>
          <Text variant="body" color={C.sub} style={styles.emptyDesc}>
            {search
              ? `Nenhum resultado para "${search}"`
              : 'Adicione seus medicamentos para receber lembretes e controlar o estoque.'}
          </Text>
          {!search && (
            <Button
              variant="primary"
              size="md"
              onPress={() => router.push('/add-medicine' as never)}
            >
              Adicionar medicamento
            </Button>
          )}
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {!isLoading && sections.length > 0 && (
        <SectionList<Medicine, { title: string }>
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: C.border }]} />
          )}
          extraData={[selectionMode, selectedIds]}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15 },

  hint: { textAlign: 'center', paddingTop: 4, paddingBottom: 2 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionLetter: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 72 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconPhoto: { width: 46, height: 46, borderRadius: 12 },
  rowInfo: { flex: 1, gap: 2 },

  // Stock chip
  stockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 4,
  },
  stockDot: { width: 6, height: 6, borderRadius: 3 },

  menuBtn: { padding: 4 },

  // Skeleton
  skeletonWrap: { padding: 16, gap: 10 },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyDesc: { textAlign: 'center', lineHeight: 21 },
});
