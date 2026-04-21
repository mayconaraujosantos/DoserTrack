import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createMedicine } from '@/lib/database';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';
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

export default function AddMedicineScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState<MedicineType>('capsule');
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: createMedicine,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      router.back();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar o medicamento.'),
  });

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert('Nome obrigatório', 'Digite o nome do medicamento.');
    const qty = Number.parseFloat(stock);
    if (Number.isNaN(qty) || qty < 0) return Alert.alert('Quantidade inválida', 'Digite uma quantidade válida.');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.photoBox} onPress={pickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoImg} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={32} color={C.sub} />
            <Text style={styles.photoHint}>Foto (opcional)</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Nome do medicamento *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Amoxicilina"
        placeholderTextColor={C.sub}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.typeGrid}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, type === t.value && styles.typeBtnActive]}
            onPress={() => setType(t.value)}
          >
            <Ionicons
              name={t.icon as never}
              size={20}
              color={type === t.value ? '#fff' : C.sub}
            />
            <Text style={[styles.typeBtnText, type === t.value && styles.typeBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Quantidade em estoque</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="0"
          placeholderTextColor={C.sub}
          keyboardType="decimal-pad"
          value={stock}
          onChangeText={setStock}
        />
        <View style={styles.unitBadge}>
          <Text style={styles.unitText}>{UNITS[type]}</Text>
        </View>
      </View>

      <Text style={styles.label}>Avisar estoque baixo abaixo de</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="5"
          placeholderTextColor={C.sub}
          keyboardType="decimal-pad"
          value={threshold}
          onChangeText={setThreshold}
        />
        <View style={styles.unitBadge}>
          <Text style={styles.unitText}>{UNITS[type]}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Salvar medicamento</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, gap: 8, paddingBottom: 40 },
    photoBox: { alignSelf: 'center', marginBottom: 8 },
    photoImg: { width: 100, height: 100, borderRadius: 16 },
    photoPlaceholder: {
      width: 100, height: 100, borderRadius: 16,
      backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
      borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    photoHint: { fontSize: 11, color: C.sub },
    label: { fontSize: 13, fontWeight: '600', color: C.sub, marginTop: 8, marginBottom: 4 },
    input: {
      backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, height: 48,
      fontSize: 15, color: C.text, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
      backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    typeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    typeBtnText: { fontSize: 13, color: C.sub, fontWeight: '500' },
    typeBtnTextActive: { color: '#fff' },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    unitBadge: {
      backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, height: 48,
      justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    unitText: { fontSize: 13, color: C.sub, fontWeight: '600' },
    submitBtn: {
      backgroundColor: C.primary, height: 52, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center', marginTop: 16,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
