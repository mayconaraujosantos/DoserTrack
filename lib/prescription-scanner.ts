import type { MedicineType } from '@/types';
import { supabase } from '@/lib/supabase';

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

export async function scanPrescription(base64Image: string): Promise<PrescriptionData[]> {
  if (!supabase) {
    throw new Error(
      'Leitura de receitas requer conta Doser. Faça login para usar esta funcionalidade.'
    );
  }

  console.log('[Scanner] Enviando para Edge Function, tamanho base64:', base64Image.length);

  const { data, error } = await supabase.functions.invoke('scan-prescription', {
    body: { image: base64Image },
  });

  if (error) {
    console.error('[Scanner] Erro na Edge Function:', error);
    let message = error.message ?? 'Não foi possível analisar a receita. Tente novamente.';
    if ('context' in error && error.context instanceof Response) {
      const body = await (error.context as Response).json().catch(() => ({}));
      if (body?.error) message = body.error as string;
    }
    throw new Error(message);
  }

  if (data?.error) {
    console.error('[Scanner] Erro retornado pela função:', data.error);
    throw new Error(data.error as string);
  }

  const medications = data?.medications as PrescriptionData[] | undefined;
  if (!Array.isArray(medications)) {
    throw new Error(
      'Não foi possível interpretar a receita. Verifique se a imagem está legível e tente novamente.'
    );
  }

  if (medications.length === 0) {
    throw new Error(
      'Nenhum medicamento encontrado. Verifique se a imagem está nítida e se é uma receita médica.'
    );
  }

  console.log('[Scanner] Parseado com sucesso:', medications.length, 'medicamento(s)');
  return medications;
}
