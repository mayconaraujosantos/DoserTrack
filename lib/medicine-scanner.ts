import type { MedicineType } from '@/types';
import { supabase } from '@/lib/supabase';

export interface MedicinePackageData {
  name: string;
  concentration?: string | null;
  type: MedicineType;
  stockQuantity?: number | null;
  stockUnit?: string | null;
}

export async function scanMedicine(base64Image: string): Promise<MedicinePackageData> {
  if (!supabase) {
    throw new Error(
      'Leitura de embalagens requer conta Doser. Faça login para usar esta funcionalidade.'
    );
  }

  console.log('[MedicineScanner] Enviando para Edge Function, tamanho base64:', base64Image.length);

  const { data, error } = await supabase.functions.invoke('scan-medicine', {
    body: { image: base64Image },
  });

  if (error) {
    let message = 'Não foi possível analisar a embalagem. Tente novamente.';
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      const body = await (ctx as Response).json().catch(() => ({}));
      const status = (ctx as Response).status;
      console.error('[MedicineScanner] HTTP', status, body);
      if (body?.error) message = body.error as string;
    } else {
      console.error('[MedicineScanner] Erro na Edge Function:', error);
    }
    throw new Error(message);
  }

  if (data?.error) {
    console.error('[MedicineScanner] Erro retornado pela função:', data.error);
    throw new Error(data.error as string);
  }

  const medicine = data?.medicine as MedicinePackageData | undefined;
  if (!medicine || typeof medicine.name !== 'string') {
    throw new Error(
      'Não foi possível interpretar a embalagem. Verifique se a imagem está legível e tente novamente.'
    );
  }

  console.log('[MedicineScanner] Parseado com sucesso:', medicine.name);
  return medicine;
}
