import { invokeScanEdgeFunction } from '@/lib/scanner-client';
import type { MedicineType } from '@/types';

export interface MedicinePackageData {
  name: string;
  concentration?: string | null;
  type: MedicineType;
  stockQuantity?: number | null;
  stockUnit?: string | null;
}

export async function scanMedicine(base64Image: string): Promise<MedicinePackageData> {
  const data = await invokeScanEdgeFunction('scan-medicine', base64Image, {
    logTag: '[MedicineScanner]',
    authRequiredMessage:
      'Leitura de embalagens requer conta Doser. Faça login para usar esta funcionalidade.',
    retryDelaysMs: [1500, 3000],
  });

  const medicine = (data as { medicine?: MedicinePackageData })?.medicine;
  if (!medicine || typeof medicine.name !== 'string') {
    throw new Error(
      'Não foi possível interpretar a embalagem. Verifique se a imagem está legível e tente novamente.'
    );
  }

  console.log('[MedicineScanner] Parseado com sucesso:', medicine.name);
  return medicine;
}
