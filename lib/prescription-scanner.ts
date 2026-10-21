import { invokeScanEdgeFunction } from '@/lib/scanner-client';
import type { MedicineType } from '@/types';

export interface PrescriptionData {
  name: string;
  concentration?: string;
  type: MedicineType;
  quantity?: number;
  instructions?: string;
  // intervalo fixo em horas: 8 para "8/8h", 12 para "12/12h"
  frequencyHours?: number;
  // doses por dia quando não for intervalo fixo: 1 para "1x ao dia", 2 para "manhã e noite"
  timesPerDay?: number;
  // descritores de horário extraídos da instrução: ["manhã"], ["após jantar"], ["manhã", "noite"]
  timeHints?: string[];
  // doses por semana para uso semanal: 1 para "1x por semana"
  timesPerWeek?: number;
  // duração em dias; null/undefined = contínuo
  durationDays?: number;
  // true quando houver "USO CONTÍNUO", "uso permanente" ou similar
  isContinuous?: boolean;
  // true para medicamentos condicionais: "se necessário", "caso haja dor/febre", SOS, PRN
  isSos?: boolean;
  doctorName?: string;
}

function validateMedicationsResponse(data: unknown): PrescriptionData[] {
  const medications = (data as { medications?: PrescriptionData[] })?.medications;

  if (!Array.isArray(medications)) {
    throw new TypeError(
      'Não foi possível interpretar a receita. Verifique se a imagem está legível e tente novamente.'
    );
  }

  if (medications.length === 0) {
    throw new Error(
      'Nenhum medicamento encontrado. Verifique se a imagem está nítida e se é uma receita médica.'
    );
  }

  return medications;
}

export async function scanPrescription(base64Image: string): Promise<PrescriptionData[]> {
  const data = await invokeScanEdgeFunction('scan-prescription', base64Image, {
    logTag: '[Scanner]',
    authRequiredMessage:
      'Leitura de receitas requer conta Doser. Faça login para usar esta funcionalidade.',
    retryDelaysMs: [1500, 3000],
  });

  const medications = validateMedicationsResponse(data);
  console.log('[Scanner] Parseado com sucesso:', medications.length, 'medicamento(s)');
  return medications;
}
