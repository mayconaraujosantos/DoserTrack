import { supabase } from '@/lib/supabase';

const RETRYABLE_STATUSES = [503, 429];
const OVERLOADED_MESSAGE =
  'O serviço de análise está temporariamente sobrecarregado. Tente novamente em alguns minutos.';

interface ScanEdgeFunctionOptions {
  logTag: string;
  authRequiredMessage: string;
  retryDelaysMs?: number[];
}

async function parseInvokeError(
  error: unknown,
  logTag: string
): Promise<{ message: string; retryable: boolean }> {
  let message =
    (error as { message?: string })?.message ??
    'Não foi possível processar a imagem. Tente novamente.';
  let retryable = false;

  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    const body = await context.json().catch(() => ({}));
    console.error(`${logTag} Erro HTTP`, context.status, body);
    if (body?.error) message = body.error as string;
    retryable = RETRYABLE_STATUSES.includes(context.status);
  } else {
    console.error(`${logTag} Erro na Edge Function:`, error);
  }

  return { message, retryable };
}

async function waitBeforeRetry(
  attempt: number,
  retryDelaysMs: number[],
  logTag: string
): Promise<void> {
  if (attempt > 0) {
    console.log(`${logTag} Tentativa ${attempt + 1} após ${retryDelaysMs[attempt - 1]}ms...`);
    await new Promise(resolve => setTimeout(resolve, retryDelaysMs[attempt - 1]));
  }
}

export async function invokeScanEdgeFunction(
  functionName: string,
  base64Image: string,
  { logTag, authRequiredMessage, retryDelaysMs = [] }: ScanEdgeFunctionOptions
): Promise<unknown> {
  if (!supabase) {
    throw new Error(authRequiredMessage);
  }

  console.log(`${logTag} Enviando para Edge Function, tamanho base64:`, base64Image.length);

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    await waitBeforeRetry(attempt, retryDelaysMs, logTag);

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { image: base64Image },
    });

    if (error) {
      const { message, retryable } = await parseInvokeError(error, logTag);
      if (retryable && attempt < retryDelaysMs.length) continue;
      throw new Error(retryable ? OVERLOADED_MESSAGE : message);
    }

    if (data?.error) {
      console.error(`${logTag} Erro retornado pela função:`, data.error);
      throw new Error(data.error as string);
    }

    return data;
  }

  throw new Error('Não foi possível processar a imagem. Tente novamente.');
}
