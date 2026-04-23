import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { scanPrescription, type PrescriptionData } from '@/lib/prescription-scanner';
import { createMedicine, createSchedule, generateDosesForSchedule } from '@/lib/database';
import { rescheduleAllPendingDoses } from '@/lib/notifications';
import { useTheme, type ThemeColors } from '@/hooks/use-theme';

const UNITS: Record<string, string> = {
  capsule: 'cápsulas', tablet: 'comprimidos', drop: 'frascos',
  ml: 'mL', injection: 'ampolas', other: 'unidades',
};

const TYPE_LABELS: Record<string, string> = {
  drop: 'Gota',
  tablet: 'Comprimido',
  capsule: 'Cápsula',
  ml: 'mL',
  injection: 'Injeção',
  other: 'Outro',
};

function MedicineResultCard({ item, index, onAdd }: Readonly<{
  item: PrescriptionData;
  index: number;
  onAdd: (item: PrescriptionData) => Promise<void>;
}>) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleAdd() {
    setSaving(true);
    try {
      await onAdd(item);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={styles.resultBadge}>
          <Text style={styles.resultBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.resultHeaderText} numberOfLines={1}>{item.name}</Text>
        {saved ? (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Salvo</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, saving && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={saving}
            accessibilityLabel={saving ? `Salvando ${item.name}` : `Adicionar ${item.name}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={18} color="#fff" />}
            <Text style={styles.addBtnText}>{saving ? 'Salvando...' : 'Adicionar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {item.concentration && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Concentração</Text>
          <Text style={styles.resultValue}>{item.concentration}</Text>
        </View>
      )}
      <View style={styles.resultRow}>
        <Text style={styles.resultLabel}>Forma</Text>
        <Text style={styles.resultValue}>{TYPE_LABELS[item.type] ?? item.type}</Text>
      </View>
      {item.frequencyHours != null && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Frequência</Text>
          <Text style={styles.resultValue}>A cada {item.frequencyHours}h</Text>
        </View>
      )}
      {item.durationDays != null && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Duração</Text>
          <Text style={styles.resultValue}>{item.durationDays} dias</Text>
        </View>
      )}
      {item.instructions && (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Instruções</Text>
          <Text style={[styles.resultValue, styles.resultValueSmall]}>{item.instructions}</Text>
        </View>
      )}
    </View>
  );
}

export default function ScanPrescriptionScreen() {
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<PrescriptionData[]>([]);

  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const qc = useQueryClient();

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para continuar.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.3,
      base64: true,
    });
    if (!picked.canceled && picked.assets[0]) {
      setImageUri(picked.assets[0].uri);
      setImageBase64(picked.assets[0].base64 ?? undefined);
      setResults([]);
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
      quality: 0.3,
      base64: true,
    });
    if (!taken.canceled && taken.assets[0]) {
      setImageUri(taken.assets[0].uri);
      setImageBase64(taken.assets[0].base64 ?? undefined);
      setResults([]);
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    setScanning(true);
    setResults([]);
    try {
      const data = await scanPrescription(imageBase64);
      setResults(data);
    } catch (err) {
      Alert.alert('Erro ao analisar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setScanning(false);
    }
  }

  async function addMedicine(item: PrescriptionData) {
    const fullName = item.concentration ? `${item.name} ${item.concentration}` : item.name;
    const medicine = await createMedicine({
      name: fullName,
      type: item.type,
      stockQuantity: item.quantity ?? 0,
      stockUnit: UNITS[item.type] ?? 'unidades',
      lowStockThreshold: 2,
    });

    if (item.frequencyHours && item.durationDays) {
      const today = new Date();
      const startDate = today.toISOString().slice(0, 10);
      const endDay = new Date(today);
      endDay.setDate(today.getDate() + item.durationDays - 1);
      const endDate = endDay.toISOString().slice(0, 10);

      const schedule = await createSchedule({
        medicineId: medicine.id,
        dosage: item.instructions ?? 'Conforme receita',
        frequencyConfig: {
          type: 'interval_hours',
          intervalHours: item.frequencyHours,
          times: ['08:00'],
        },
        startDate,
        endDate,
        isActive: true,
      });

      await generateDosesForSchedule(schedule);
      rescheduleAllPendingDoses().catch(console.error);
    }

    qc.invalidateQueries({ queryKey: ['medicines'] });
    qc.invalidateQueries({ queryKey: ['doses'] });
    qc.invalidateQueries({ queryKey: ['week-adherence'] });
    qc.invalidateQueries({ queryKey: ['streak'] });
  }

  function reset() {
    setResults([]);
    setImageUri(undefined);
    setImageBase64(undefined);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Escanear Receita</Text>
      <Text style={styles.subtitle}>
        Fotografe ou selecione a receita para preencher os medicamentos automaticamente.
      </Text>

      <View style={styles.imageArea}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="document-text-outline" size={56} color={C.border} />
            <Text style={styles.placeholderText}>Nenhuma imagem selecionada</Text>
          </View>
        )}
      </View>

      <View style={styles.captureRow}>
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={takePhoto}
          accessibilityLabel="Tirar foto com câmera"
          accessibilityRole="button"
        >
          <Ionicons name="camera-outline" size={20} color={C.primary} />
          <Text style={styles.captureBtnText}>Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={pickFromGallery}
          accessibilityLabel="Selecionar imagem da galeria"
          accessibilityRole="button"
        >
          <Ionicons name="images-outline" size={20} color={C.primary} />
          <Text style={styles.captureBtnText}>Galeria</Text>
        </TouchableOpacity>
      </View>

      {!!imageUri && results.length === 0 && (
        <TouchableOpacity
          style={[styles.analyzeBtn, scanning && styles.analyzeBtnDisabled]}
          onPress={analyze}
          disabled={scanning}
          accessibilityLabel={scanning ? 'Analisando receita' : 'Analisar receita com inteligência artificial'}
          accessibilityRole="button"
          accessibilityState={{ disabled: scanning }}
        >
          {scanning ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.analyzeBtnText}>Analisando receita...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles-outline" size={20} color="#fff" />
              <Text style={styles.analyzeBtnText}>Analisar Receita</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {results.length > 0 && (
        <>
          <View style={styles.resultsHeader}>
            <Ionicons name="checkmark-circle" size={20} color={C.success} />
            <Text style={styles.resultsHeaderText}>
              {results.length} medicamento{results.length > 1 ? 's' : ''} encontrado{results.length > 1 ? 's' : ''}
            </Text>
          </View>

          {results.map((item, index) => (
            <MedicineResultCard
              key={`${item.name}-${index}`}
              item={item}
              index={index}
              onAdd={addMedicine}
            />
          ))}

          <TouchableOpacity
            style={styles.retryBtn}
            onPress={reset}
            accessibilityLabel="Escanear outra receita"
            accessibilityRole="button"
          >
            <Text style={styles.retryBtnText}>Escanear outra receita</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, gap: 16, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: '700', color: C.text },
    subtitle: { fontSize: 14, color: C.sub, lineHeight: 20 },
    imageArea: {
      borderRadius: 16, overflow: 'hidden',
      borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
      minHeight: 220, backgroundColor: C.card,
    },
    image: { width: '100%', height: 320 },
    imagePlaceholder: {
      height: 220, alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    placeholderText: { fontSize: 14, color: C.sub },
    captureRow: { flexDirection: 'row', gap: 12 },
    captureBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 48, borderRadius: 12, backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    captureBtnText: { fontSize: 15, fontWeight: '600', color: C.primary },
    analyzeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 52, borderRadius: 14, backgroundColor: C.primary,
    },
    analyzeBtnDisabled: { opacity: 0.7 },
    analyzeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    resultsHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    resultsHeaderText: { fontSize: 16, fontWeight: '700', color: C.text },
    resultCard: {
      backgroundColor: C.card, borderRadius: 16, padding: 14, gap: 8,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    },
    resultHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
    },
    resultBadge: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: C.primary + '22', alignItems: 'center', justifyContent: 'center',
    },
    resultBadgeText: { fontSize: 12, fontWeight: '700', color: C.primary },
    resultHeaderText: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.primary, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    savedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.success, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    resultRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start', paddingVertical: 3,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    resultLabel: { fontSize: 12, color: C.sub, fontWeight: '500', flex: 1 },
    resultValue: { fontSize: 12, color: C.text, fontWeight: '600', flex: 2, textAlign: 'right' },
    resultValueSmall: { fontSize: 11 },
    retryBtn: { alignItems: 'center', paddingVertical: 8 },
    retryBtnText: { fontSize: 14, color: C.sub, textDecorationLine: 'underline' },
  });
}
