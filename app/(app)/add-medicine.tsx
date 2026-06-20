import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createMedicine } from '@/lib/database';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { notifyLowStock } from '@/lib/notifications';
import { syncToCloud } from '@/lib/sync';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import type { MedicineType } from '@/types';

const TYPES: { value: MedicineType; label: string; icon: string }[] = [
  { value: 'capsule', label: 'Cápsula', icon: 'ellipse' },
  { value: 'tablet', label: 'Comprimido', icon: 'square' },
  { value: 'drop', label: 'Gota', icon: 'water' },
  { value: 'ml', label: 'mL', icon: 'flask' },
  { value: 'injection', label: 'Injeção', icon: 'fitness' },
  { value: 'other', label: 'Outro', icon: 'medical' },
];

const UNITS: Record<MedicineType, string> = {
  capsule: 'cápsulas',
  tablet: 'comprimidos',
  drop: 'frascos',
  ml: 'mL',
  injection: 'ampolas',
  other: 'unidades',
};

// ─── FormSection ──────────────────────────────────────────────────────────────

function FormSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  const C = useTheme();
  return (
    <View style={sectionStyles.wrap}>
      <Text variant="caption" color={C.sub} style={sectionStyles.title}>
        {title}
      </Text>
      <View style={[sectionStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { gap: 6 },
  title: {
    paddingHorizontal: 4,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddMedicineScreen() {
  const params = useLocalSearchParams<{
    prefill_name?: string;
    prefill_type?: string;
    prefill_quantity?: string;
    prefill_concentration?: string;
  }>();

  const prefillType = params.prefill_type as MedicineType | undefined;
  const validTypes: MedicineType[] = ['capsule', 'tablet', 'drop', 'ml', 'injection', 'other'];
  const resolvedType: MedicineType =
    prefillType && validTypes.includes(prefillType) ? prefillType : 'capsule';

  let prefillName = '';
  if (params.prefill_name) {
    prefillName = params.prefill_concentration
      ? `${params.prefill_name} ${params.prefill_concentration}`
      : params.prefill_name;
  }

  const [name, setName] = useState(prefillName);
  const [type, setType] = useState<MedicineType>(resolvedType);
  const [stock, setStock] = useState(params.prefill_quantity ?? '');
  const [threshold, setThreshold] = useState('5');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const C = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: createMedicine,
    onSuccess: medicine => {
      haptic.success();
      if (medicine.stockQuantity <= medicine.lowStockThreshold) {
        notifyLowStock(medicine).catch(console.error);
      }
      syncToCloud().catch(console.error);
      qc.invalidateQueries({ queryKey: ['medicines'] });
      router.back();
    },
    onError: () => {
      haptic.error();
      Alert.alert('Erro', 'Não foi possível salvar o medicamento.');
    },
  });

  async function launchGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function launchCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  function pickPhoto() {
    Alert.alert('Foto do medicamento', 'Escolha a origem da foto', [
      { text: 'Câmera', onPress: launchCamera },
      { text: 'Galeria', onPress: launchGallery },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert('Nome obrigatório', 'Digite o nome do medicamento.');
    const qty = stock.trim() === '' ? 0 : Number.parseFloat(stock);
    if (Number.isNaN(qty) || qty < 0)
      return Alert.alert('Quantidade inválida', 'Digite uma quantidade válida.');
    const thresh = Number.parseFloat(threshold);
    mutation.mutate({
      name: trimmed,
      type,
      stockQuantity: qty,
      stockUnit: UNITS[type],
      photoUri,
      lowStockThreshold: Number.isNaN(thresh) ? 5 : thresh,
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Foto ─────────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.photoWrap}
        onPress={pickPhoto}
        accessibilityLabel={photoUri ? 'Alterar foto' : 'Adicionar foto'}
        accessibilityRole="button"
      >
        {photoUri ? (
          <>
            <Image source={{ uri: photoUri }} style={styles.photoImg} />
            <View style={[styles.photoEditBadge, { backgroundColor: C.primary }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </>
        ) : (
          <View
            style={[styles.photoPlaceholder, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Ionicons name="camera-outline" size={32} color={C.sub} />
            <Text variant="caption" color={C.sub}>
              Foto (opcional)
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Identificação ────────────────────────────────────────────────────── */}
      <FormSection title="Identificação">
        <View style={[styles.inputRow, { borderBottomColor: C.border }]}>
          <Input
            label="Nome do medicamento *"
            placeholder="Ex: Amoxicilina 500mg"
            value={name}
            onChangeText={setName}
            autoFocus
            style={styles.inputInner}
          />
        </View>
        <View style={styles.typeGrid}>
          {TYPES.map(t => {
            const active = type === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: active ? C.primary : C.bg,
                    borderColor: active ? C.primary : C.border,
                  },
                ]}
                onPress={() => setType(t.value)}
                accessibilityLabel={t.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={t.icon as never} size={16} color={active ? '#fff' : C.sub} />
                <Text variant="label" color={active ? '#fff' : C.sub}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormSection>

      {/* ── Estoque ──────────────────────────────────────────────────────────── */}
      <FormSection title="Estoque">
        <View
          style={[
            styles.inputRow,
            { borderBottomColor: C.border, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Input
            label="Quantidade atual"
            placeholder="0"
            keyboardType="decimal-pad"
            value={stock}
            onChangeText={setStock}
            accessory={
              <View style={[styles.unitBadge, { backgroundColor: C.bg }]}>
                <Text variant="label" color={C.sub}>
                  {UNITS[type]}
                </Text>
              </View>
            }
            style={styles.inputInner}
          />
        </View>
        <View style={styles.inputRow}>
          <Input
            label="Alerta de estoque baixo abaixo de"
            placeholder="5"
            keyboardType="decimal-pad"
            value={threshold}
            onChangeText={setThreshold}
            accessory={
              <View style={[styles.unitBadge, { backgroundColor: C.bg }]}>
                <Text variant="label" color={C.sub}>
                  {UNITS[type]}
                </Text>
              </View>
            }
            style={styles.inputInner}
          />
        </View>
      </FormSection>

      <Button
        variant="primary"
        size="lg"
        loading={mutation.isPending}
        onPress={submit}
        style={styles.submitBtn}
        accessibilityLabel="Salvar medicamento"
      >
        Salvar medicamento
      </Button>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 48 },

  // Photo
  photoWrap: { alignSelf: 'center', marginBottom: 4 },
  photoImg: { width: 112, height: 112, borderRadius: 22 },
  photoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Type grid inside section card
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Inputs inside section card
  inputRow: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4 },
  inputInner: { flex: 1 },
  unitBadge: { paddingHorizontal: 8, borderRadius: 6, paddingVertical: 2 },

  submitBtn: { marginTop: 4 },
});
