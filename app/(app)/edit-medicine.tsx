import { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getMedicineById, updateMedicine } from '@/lib/database';
import { useAppStore } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function EditMedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicineId = Number.parseInt(id ?? '0');

  const [name, setName] = useState('');
  const [type, setType] = useState<MedicineType>('capsule');
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const C = useTheme();
  const insets = useSafeAreaInsets();
  const dbReady = useAppStore(s => s.dbReady);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: medicine, isLoading } = useQuery({
    queryKey: ['medicine', medicineId],
    queryFn: () => getMedicineById(medicineId),
    enabled: dbReady && medicineId > 0,
  });

  useEffect(() => {
    if (!medicine) return;
    setName(medicine.name);
    setType(medicine.type);
    setStock(String(medicine.stockQuantity));
    setThreshold(String(medicine.lowStockThreshold));
    setPhotoUri(medicine.photoUri);
  }, [medicine]);

  const mutation = useMutation({
    mutationFn: () =>
      updateMedicine(medicineId, {
        name: name.trim(),
        type,
        stockQuantity: Number.parseFloat(stock) || 0,
        stockUnit: UNITS[type],
        photoUri,
        lowStockThreshold: Number.parseFloat(threshold) || 5,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      qc.invalidateQueries({ queryKey: ['medicine', medicineId] });
      router.back();
    },
    onError: () => Alert.alert('Erro', 'Não foi possível salvar as alterações.'),
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
      Alert.alert(
        'Permissão necessária',
        'Permita o acesso à câmera nas configurações do aparelho.'
      );
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
    if (!name.trim()) return Alert.alert('Nome obrigatório', 'Digite o nome do medicamento.');
    const qty = Number.parseFloat(stock);
    if (Number.isNaN(qty) || qty < 0)
      return Alert.alert('Quantidade inválida', 'Digite uma quantidade válida.');
    mutation.mutate();
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.photoBox}
        onPress={pickPhoto}
        accessibilityLabel={
          photoUri ? 'Alterar foto do medicamento' : 'Adicionar foto do medicamento'
        }
        accessibilityRole="button"
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoImg} />
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

      <Input
        label="Nome do medicamento *"
        placeholder="Ex: Amoxicilina"
        value={name}
        onChangeText={setName}
        style={styles.inputText}
      />

      <Text variant="label" color={C.sub} style={styles.sectionLabel}>
        Tipo
      </Text>
      <View style={styles.typeGrid}>
        {TYPES.map(t => {
          const active = type === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              style={[
                styles.typeBtn,
                {
                  backgroundColor: active ? C.primary : C.card,
                  borderColor: active ? C.primary : C.border,
                },
              ]}
              onPress={() => setType(t.value)}
              accessibilityLabel={t.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={t.icon as never} size={20} color={active ? '#fff' : C.sub} />
              <Text variant="label" color={active ? '#fff' : C.sub}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="Quantidade em estoque"
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
        style={styles.inputText}
      />

      <Input
        label="Avisar estoque baixo abaixo de"
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
        style={styles.inputText}
      />

      <Button
        variant="primary"
        size="lg"
        loading={mutation.isPending}
        onPress={submit}
        style={styles.submitBtn}
        accessibilityLabel="Salvar alterações"
      >
        Salvar alterações
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  photoBox: { alignSelf: 'center', marginBottom: 8 },
  photoImg: { width: 100, height: 100, borderRadius: 16 },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sectionLabel: { marginTop: 4, marginBottom: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unitBadge: { paddingHorizontal: 8 },
  inputText: { flex: 1 },
  submitBtn: { marginTop: 8 },
});
