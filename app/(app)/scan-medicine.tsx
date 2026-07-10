import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';
import { SuccessToast } from '@/components/ui/toast/SuccessToast';
import { Text } from '@/components/ui/text/Text';
import { useTheme } from '@/hooks/use-theme';
import { createMedicine } from '@/lib/database';
import { scanMedicine, type MedicinePackageData } from '@/lib/medicine-scanner';
import { invalidateTrackingQueries } from '@/lib/query-keys';
import type { MedicineType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

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

interface ConfirmState {
  name: string;
  concentration: string;
  type: MedicineType;
  stockQuantity: string;
  stockUnit: string;
}

function EditableResultCard({
  data,
  saved,
  saving,
  onSave,
}: Readonly<{
  data: MedicinePackageData;
  saved: boolean;
  saving: boolean;
  onSave: (state: ConfirmState) => void;
}>) {
  const C = useTheme();
  const initialStock = data.stockQuantity == null ? '0' : String(data.stockQuantity);
  const [name, setName] = useState(data.name);
  const [concentration, setConcentration] = useState(data.concentration ?? '');
  const [type, setType] = useState<MedicineType>(data.type);
  const [stockQuantity, setStockQuantity] = useState(initialStock);
  const [stockUnit, setStockUnit] = useState(data.stockUnit ?? DEFAULT_UNITS[data.type]);

  useEffect(() => {
    setName(data.name);
    setConcentration(data.concentration ?? '');
    setType(data.type);
    setStockQuantity(data.stockQuantity == null ? '0' : String(data.stockQuantity));
    setStockUnit(data.stockUnit ?? DEFAULT_UNITS[data.type]);
  }, [data]);

  function handleTypeChange(t: MedicineType) {
    setType(t);
    setStockUnit(DEFAULT_UNITS[t]);
  }

  function handleConfirm() {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome do medicamento é obrigatório.');
      return;
    }
    onSave({ name, concentration, type, stockQuantity, stockUnit });
  }

  let saveButtonText = 'Salvar medicamento';
  if (saving) saveButtonText = 'Salvando...';
  else if (saved) saveButtonText = 'Medicamento salvo';

  return (
    <Card variant="outlined" style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
          Medicamento identificado
        </Text>
        {saved ? (
          <View style={[cardStyles.badge, { backgroundColor: C.success }]}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text variant="label" color="#fff">
              Salvo
            </Text>
          </View>
        ) : null}
      </View>

      <Input
        label="Nome do medicamento"
        value={name}
        onChangeText={setName}
        placeholder="Ex: Paracetamol"
      />

      <Input
        label="Concentração"
        value={concentration}
        onChangeText={setConcentration}
        placeholder="Ex: 750mg"
      />

      <View>
        <Text variant="caption" color={C.sub} style={cardStyles.sectionLabel}>
          Forma farmacêutica
        </Text>
        <View style={cardStyles.typeRow}>
          {ALL_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[
                cardStyles.typeChip,
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

      <View>
        <Text variant="caption" color={C.sub} style={cardStyles.sectionLabel}>
          Estoque inicial
        </Text>
        <View style={cardStyles.stockRow}>
          <Input
            value={stockQuantity}
            onChangeText={setStockQuantity}
            keyboardType="numeric"
            placeholder="0"
            style={cardStyles.stockInput}
          />
          <Input
            value={stockUnit}
            onChangeText={setStockUnit}
            placeholder="unidades"
            style={cardStyles.stockUnitInput}
          />
        </View>
      </View>

      <Button
        variant="primary"
        size="lg"
        icon={
          saving ? undefined : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
        }
        onPress={handleConfirm}
        loading={saving}
        disabled={saved || saving}
        accessibilityLabel={saving ? 'Salvando medicamento' : 'Salvar medicamento'}
      >
        {saveButtonText}
      </Button>
    </Card>
  );
}

const cardStyles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionLabel: { marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  stockRow: { flexDirection: 'row', gap: 10 },
  stockInput: { width: 100 },
  stockUnitInput: { flex: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScanMedicineScreen() {
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MedicinePackageData | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<{
    title: string;
    message: string;
    actionLabel?: string;
    actionMedicineId?: number;
  } | null>(null);
  const [resetAfterToast, setResetAfterToast] = useState(false);

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

  async function handleSave(state: ConfirmState) {
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
      invalidateTrackingQueries(qc);
      setResetAfterToast(true);

      setSuccessToast({
        title: 'Medicamento salvo!',
        message: `${fullName} foi adicionado à sua lista.`,
        actionLabel: 'Criar horário de alarme',
        actionMedicineId: medicine.id,
      });
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
              scanning ? undefined : <Ionicons name="sparkles-outline" size={20} color="#fff" />
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

            <EditableResultCard data={result} saved={saved} saving={saving} onSave={handleSave} />

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

      <SuccessToast
        visible={!!successToast}
        title={successToast?.title ?? ''}
        message={successToast?.message}
        actionLabel={successToast?.actionLabel}
        preset="withAction"
        onAction={() => {
          if (!successToast?.actionMedicineId) return;
          const medicineId = successToast.actionMedicineId;
          setResetAfterToast(false);
          reset();
          setSuccessToast(null);
          router.push(`/add-schedule?medicineId=${medicineId}` as never);
        }}
        onHide={() => {
          setSuccessToast(null);
          if (resetAfterToast) {
            setResetAfterToast(false);
            reset();
          }
        }}
      />
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
