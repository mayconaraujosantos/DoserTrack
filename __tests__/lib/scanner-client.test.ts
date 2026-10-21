jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { invokeScanEdgeFunction } from '@/lib/scanner-client';
import { supabase } from '@/lib/supabase';

const mockInvoke = (supabase as NonNullable<typeof supabase>).functions.invoke as jest.Mock;

function httpError(status: number, body: Record<string, unknown> = {}) {
  const response = new Response(JSON.stringify(body), { status });
  return { message: `HTTP ${status}`, context: response };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('invokeScanEdgeFunction', () => {
  it('retorna data na primeira tentativa sem esperar nenhum delay', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });

    const result = await invokeScanEdgeFunction('scan-x', 'base64img', {
      logTag: '[Test]',
      authRequiredMessage: 'auth requerida',
      retryDelaysMs: [1500, 3000],
    });

    expect(result).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('scan-x', { body: { image: 'base64img' } });
  });

  it('tenta de novo em erro 503 e retorna sucesso na segunda tentativa', async () => {
    jest.useFakeTimers();
    mockInvoke
      .mockResolvedValueOnce({ data: null, error: httpError(503, { error: 'sobrecarregado' }) })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const promise = invokeScanEdgeFunction('scan-x', 'base64img', {
      logTag: '[Test]',
      authRequiredMessage: 'auth requerida',
      retryDelaysMs: [1500, 3000],
    });

    await jest.advanceTimersByTimeAsync(1500);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('lança a mensagem genérica de sobrecarregado quando as tentativas se esgotam', async () => {
    jest.useFakeTimers();
    mockInvoke.mockResolvedValue({ data: null, error: httpError(503) });

    const promise = invokeScanEdgeFunction('scan-x', 'base64img', {
      logTag: '[Test]',
      authRequiredMessage: 'auth requerida',
      retryDelaysMs: [1500, 3000],
    });
    const assertion = expect(promise).rejects.toThrow(
      'O serviço de análise está temporariamente sobrecarregado. Tente novamente em alguns minutos.'
    );

    await jest.advanceTimersByTimeAsync(1500);
    await jest.advanceTimersByTimeAsync(3000);
    await assertion;

    expect(mockInvoke).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('lança na primeira tentativa para erro não-retryable, sem retry', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: httpError(400, { error: 'imagem inválida' }),
    });

    await expect(
      invokeScanEdgeFunction('scan-x', 'base64img', {
        logTag: '[Test]',
        authRequiredMessage: 'auth requerida',
        retryDelaysMs: [1500, 3000],
      })
    ).rejects.toThrow('imagem inválida');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('sem retryDelaysMs configurado, não faz nenhuma tentativa extra', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(503) });

    await expect(
      invokeScanEdgeFunction('scan-x', 'base64img', {
        logTag: '[Test]',
        authRequiredMessage: 'auth requerida',
      })
    ).rejects.toThrow(
      'O serviço de análise está temporariamente sobrecarregado. Tente novamente em alguns minutos.'
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('lança imediatamente em erro de negócio (data.error), sem retry', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { error: 'não é um medicamento' }, error: null });

    await expect(
      invokeScanEdgeFunction('scan-x', 'base64img', {
        logTag: '[Test]',
        authRequiredMessage: 'auth requerida',
        retryDelaysMs: [1500, 3000],
      })
    ).rejects.toThrow('não é um medicamento');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
