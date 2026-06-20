import { useTheme } from '@/hooks/use-theme';
import { createMedicine } from '@/lib/database';
import { scanMedicine, type MedicinePackageData } from '@/lib/medicine-scanner';
import type { MedicineType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<MedicineType, string> = {
  drop: 'Gota',
  tablet: 'Comprimido',
  capsule: 'Cápsula',
  ml: 'mL',
  injection: 'Injeção',
  other: 'Outro',
};

const DEFAULT_UNITS: Record<MedicineType, string> = {
  capsule: 'cápsulas',
  tablet: 'comprimidos',
  drop: 'frascos',
  ml: 'mL',
  injection: 'ampolas',
  other: 'unidades',
};

const ALL_TYPES: MedicineType[] = ['tablet', 'capsule', 'drop', 'ml', 'injection', 'other'];

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

interface ConfirmState {
  name: string;
  concentration: string;
  type: MedicineType;
  stockQuantity: string;
  stockUnit: string;
}

function ConfirmModal({
  state,
  onConfirm,
  onCancel,
}: Readonly<{
  state: ConfirmState;
  onConfirm: (s: ConfirmState) => void;
  onCancel: () => void;
}>) {
  const C = useTheme();
  const [name, setName] = useState(state.name);
  const [concentration, setConcentration] = useState(state.concentration);
  const [type, setType] = useState<MedicineType>(state.type);
  const [stockQuantity, setStockQuantity] = useState(state.stockQuantity);
  const [stockUnit, setStockUnit] = useState(state.stockUnit);

  function handleTypeChange(t: MedicineType) {
    setType(t);
    setStockUnit(DEFAULT_UNITS[t]);
  }

  function handleConfirm() {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome do medicamento é obrigatório.');
      return;
    }
    onConfirm({ name, concentration, type, stockQuantity, stockUnit });
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { backgroundColor: C.bg }]}>
          <View style={[modalStyles.handle, { backgroundColor: C.border }]} />

          <View style={modalStyles.header}>
            <Text variant="title" style={{ flex: 1 }}>
              Confirmar medicamento
            </Text>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Fechar modal">
              <Ionicons name="close" size={24} color={C.sub} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={modalStyles.section}>
              <Input
                label="Nome do medicamento"
                value={name}
                onChangeText={setName}
                placeholder="Ex: Paracetamol"
              />
            </View>

            <View style={modalStyles.section}>
              <Input
                label="Concentração"
                value={concentration}
                onChangeText={setConcentration}
                placeholder="Ex: 750mg"
              />
            </View>

            <View style={modalStyles.section}>
              <Text variant="caption" color={C.sub} style={modalStyles.sectionLabel}>
                Forma farmacêutica
              </Text>
              <View style={modalStyles.typeRow}>
                {ALL_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      modalStyles.typeChip,
                      { borderColor: C.border, backgroundColor: C.card },
                      type === t && { borderColor: C.primary, backgroundColor: C.primary + '18' },
                    ]}
                    onPress={() => handleTypeChange(t)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: type === t }}
                  >
                    <Text variant="label" color={type === t ? C.primary : C.sub}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={modalStyles.section}>
              <Text variant="caption" color={C.sub} style={modalStyles.sectionLabel}>
                Estoque inicial
              </Text>
              <View style={modalStyles.stockRow}>
                <TextInput
                  style={[
                    modalStyles.stockInput,
                    { backgroundColor: C.card, borderColor: C.border, color: C.text },
                  ]}
                  keyboardType="numeric"
                  value={stockQuantity}
                  onChangeText={setStockQuantity}
                  placeholder="0"
                  placeholderTextColor={C.sub}
                />
                <TextInput
                  style={[
                    modalStyles.unitInput,
                    { backgroundColor: C.card, borderColor: C.border, color: C.text },
                  ]}
                  value={stockUnit}
                  onChangeText={setStockUnit}
                  placeholder="unidades"
                  placeholderTextColor={C.sub}
                />
              </View>
            </View>
          </ScrollView>

          <Button
            variant="primary"
            size="lg"
            icon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
            onPress={handleConfirm}
            style={modalStyles.saveBtn}
            accessibilityLabel="Salvar medicamento"
          >
            Salvar medicamento
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    gap: 4,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionLabel: { marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  stockRow: { flexDirection: 'row', gap: 10 },
  stockInput: {
    width: 80,
    textAlign: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unitInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: { marginTop: 8 },
});

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({
  data,
  saved,
  saving,
  onAdd,
}: Readonly<{
  data: MedicinePackageData;
  saved: boolean;
  saving: boolean;
  onAdd: () => void;
}>) {
  const C = useTheme();

  return (
    <Card variant="outlined" style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
          {data.name}
          {data.concentration ? ` ${data.concentration}` : ''}
        </Text>
        {saved ? (
          <View style={[cardStyles.badge, { backgroundColor: C.success }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text variant="label" color="#fff">
              Salvo
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[cardStyles.badge, { backgroundColor: C.primary }, saving && { opacity: 0.6 }]}
            onPress={onAdd}
            disabled={saving}
            accessibilityLabel={saving ? 'Salvando medicamento' : 'Adicionar medicamento'}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={16} color="#fff" />
            )}
            <Text variant="label" color="#fff">
              {saving ? 'Salvando...' : 'Adicionar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[cardStyles.row, { borderBottomColor: C.border }]}>
        <Text variant="caption" color={C.sub} style={cardStyles.label}>
          Forma
        </Text>
        <Text variant="label" style={cardStyles.value}>
          {TYPE_LABELS[data.type] ?? data.type}
        </Text>
      </View>

      {data.stockQuantity != null && (
        <View style={[cardStyles.row, { borderBottomColor: C.border }]}>
          <Text variant="caption" color={C.sub} style={cardStyles.label}>
            Quantidade na caixa
          </Text>
          <Text variant="label" style={cardStyles.value}>
            {data.stockQuantity} {data.stockUnit ?? ''}
          </Text>
        </View>
      )}
    </Card>
  );
}

const cardStyles = StyleSheet.create({
  card: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
  value: { flex: 2, textAlign: 'right' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScanMedicineScreen() {
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MedicinePackageData | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const C = useTheme();
  const qc = useQueryClient();
  const router = useRouter();

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para continuar.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (!picked.canceled && picked.assets[0]) {
      setImageUri(picked.assets[0].uri);
      setImageBase64(picked.assets[0].base64 ?? undefined);
      setResult(null);
      setSaved(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para continuar.');
      return;
    }
    const taken = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (!taken.canceled && taken.assets[0]) {
      setImageUri(taken.assets[0].uri);
      setImageBase64(taken.assets[0].base64 ?? undefined);
      setResult(null);
      setSaved(false);
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    setScanning(true);
    setResult(null);
    setSaved(false);
    try {
      const data = await scanMedicine(imageBase64);
      setResult(data);
    } catch (err) {
      Alert.alert('Erro ao analisar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setScanning(false);
    }
  }

  function requestAdd() {
    if (!result) return;
    setConfirmState({
      name: result.name,
      concentration: result.concentration ?? '',
      type: result.type,
      stockQuantity: result.stockQuantity != null ? String(result.stockQuantity) : '0',
      stockUnit: result.stockUnit ?? DEFAULT_UNITS[result.type],
    });
  }

  async function handleConfirmSave(state: ConfirmState) {
    setConfirmState(null);
    setSaving(true);
    try {
      const fullName = state.concentration.trim()
        ? `${state.name.trim()} ${state.concentration.trim()}`
        : state.name.trim();

      const qty = Number.parseFloat(state.stockQuantity);
      const medicine = await createMedicine({
        name: fullName,
        type: state.type,
        stockQuantity: Number.isNaN(qty) ? 0 : qty,
        stockUnit: state.stockUnit.trim() || DEFAULT_UNITS[state.type],
        lowStockThreshold: 2,
      });

      setSaved(true);
      qc.invalidateQueries({ queryKey: ['medicines'] });

      Alert.alert('Medicamento salvo!', `${fullName} foi adicionado à sua lista.`, [
        {
          text: 'Criar horário de alarme',
          onPress: () => router.push(`/add-schedule?medicineId=${medicine.id}` as never),
        },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (err) {
      Alert.alert('Erro ao salvar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setResult(null);
    setSaved(false);
    setImageUri(undefined);
    setImageBase64(undefined);
  }

  return (
    <>
      {confirmState && (
        <ConfirmModal
          state={confirmState}
          onConfirm={handleConfirmSave}
          onCancel={() => setConfirmState(null)}
        />
      )}

      <ScrollView
        style={[styles.container, { backgroundColor: C.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="body" color={C.sub} style={styles.subtitle}>
          Fotografe ou selecione a embalagem do medicamento para cadastrá-lo automaticamente.
        </Text>

        <View style={[styles.imageArea, { borderColor: C.border, backgroundColor: C.card }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="medkit-outline" size={56} color={C.border} />
              <Text variant="body" color={C.sub}>
                Nenhuma imagem selecionada
              </Text>
            </View>
          )}
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity
            style={[styles.captureBtn, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={takePhoto}
            accessibilityLabel="Tirar foto com câmera"
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={20} color={C.primary} />
            <Text variant="label" color={C.primary}>
              Câmera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureBtn, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={pickFromGallery}
            accessibilityLabel="Selecionar imagem da galeria"
            accessibilityRole="button"
          >
            <Ionicons name="images-outline" size={20} color={C.primary} />
            <Text variant="label" color={C.primary}>
              Galeria
            </Text>
          </TouchableOpacity>
        </View>

        {!!imageUri && !result && (
          <Button
            variant="primary"
            size="lg"
            loading={scanning}
            onPress={analyze}
            icon={
              !scanning ? <Ionicons name="sparkles-outline" size={20} color="#fff" /> : undefined
            }
            style={styles.analyzeBtn}
            accessibilityLabel={
              scanning ? 'Analisando embalagem' : 'Analisar embalagem com inteligência artificial'
            }
          >
            {scanning ? 'Analisando embalagem...' : 'Analisar Embalagem'}
          </Button>
        )}

        {result && (
          <>
            <View style={styles.resultsHeader}>
              <Ionicons name="checkmark-circle" size={20} color={C.success} />
              <Text variant="label">Medicamento identificado</Text>
            </View>

            <ResultCard data={result} saved={saved} saving={saving} onAdd={requestAdd} />

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={reset}
              accessibilityLabel="Escanear outra embalagem"
              accessibilityRole="button"
            >
              <Text variant="body" color={C.sub} style={styles.retryBtnText}>
                Escanear outra embalagem
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  subtitle: { lineHeight: 20 },
  imageArea: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    minHeight: 220,
  },
  image: { width: '100%', height: 320 },
  imagePlaceholder: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  captureRow: { flexDirection: 'row', gap: 12 },
  captureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  analyzeBtn: {},
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryBtn: { alignItems: 'center', paddingVertical: 8 },
  retryBtnText: { textDecorationLine: 'underline' },
});
