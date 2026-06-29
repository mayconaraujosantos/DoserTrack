import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `Você é um assistente especializado em leitura de embalagens de medicamentos brasileiros.

IMPORTANTE: Se a imagem NÃO for uma embalagem, caixa, frasco ou bula de medicamento, retorne APENAS este JSON e nada mais:
{"error": "not_a_medicine"}

Se for uma embalagem de medicamento, analise a imagem e extraia as informações do produto.
Retorne APENAS um objeto JSON válido (sem markdown, sem bloco de código, sem texto extra) com esta estrutura:

{
  "name": "Nome comercial do medicamento (sem concentração e sem forma farmacêutica)",
  "concentration": "Concentração completa (ex: '500mg', '750mg', '5mg/mL') ou null se não visível",
  "type": "drop|tablet|capsule|ml|injection|other",
  "stockQuantity": número inteiro de unidades na embalagem (ex: 20 para uma caixa com 20 comprimidos) ou null se não visível,
  "stockUnit": "unidade de contagem das unidades (ex: 'comprimidos', 'cápsulas', 'mL', 'frascos', 'ampolas')"
}

Regras para o campo "type":
- "drop" → gotas, solução otológica, colírio, solução nasal
- "tablet" → comprimido, drágea
- "capsule" → cápsula, softgel
- "ml" → solução oral em mL, xarope, suspensão
- "injection" → injeção, ampola, frasco-ampola
- "other" → adesivo, creme, pomada, supositório, inalador e demais

Exemplos de extração:
- Caixa "Paracetamol 750mg — 20 comprimidos" → name: "Paracetamol", concentration: "750mg", type: "tablet", stockQuantity: 20, stockUnit: "comprimidos"
- Frasco "Dipirona Sódica Solução Oral 50mg/mL 100mL" → name: "Dipirona Sódica", concentration: "50mg/mL", type: "ml", stockQuantity: 100, stockUnit: "mL"
- Caixa "Omeprazol 20mg — 28 cápsulas" → name: "Omeprazol", concentration: "20mg", type: "capsule", stockQuantity: 28, stockUnit: "cápsulas"

Extraia exatamente o que está visível na embalagem. Se algum campo não estiver legível, use null.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image } = (await req.json()) as { image: string };
    if (!image) {
      return new Response(JSON.stringify({ error: 'Campo "image" ausente no body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiBody = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: image } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.1,
        // Desabilita thinking: evita parts com thought:true antes do JSON real
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const geminiBodyStr = JSON.stringify(geminiBody);
    let geminiRes: Response | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBodyStr,
      });
      if (geminiRes.status !== 503) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500));
    }

    if (!geminiRes || !geminiRes.ok) {
      const status = geminiRes?.status ?? 503;
      const errBody = (await geminiRes?.json().catch(() => ({}))) ?? {};
      let message = `Erro da API Gemini (${status}).`;
      if (status === 503)
        message = 'O modelo de IA está sobrecarregado. Tente novamente em alguns segundos.';
      if (status === 429)
        message = 'Limite de uso atingido. Aguarde alguns minutos e tente novamente.';
      if (status === 400) message = 'Imagem inválida ou muito grande. Tente uma foto mais nítida.';
      if (status === 403) message = 'Chave de API sem permissão para este modelo.';
      return new Response(JSON.stringify({ error: message, detail: errBody }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    type GeminiPart = { text?: string; thought?: boolean };
    const data = (await geminiRes.json()) as {
      candidates?: {
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }[];
    };

    const candidate = data.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      return new Response(
        JSON.stringify({
          error: 'A imagem foi bloqueada por filtros de segurança. Tente uma foto diferente.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ignora parts de "thinking" (thought: true) — pega o último part com texto real
    const parts = candidate?.content?.parts ?? [];
    const textPart = [...parts].reverse().find(p => !p.thought && p.text);
    const raw = textPart?.text?.trim() ?? '';

    if (!raw) {
      return new Response(
        JSON.stringify({
          error:
            'A IA não conseguiu extrair informações da imagem. Tente uma foto mais nítida e com boa iluminação.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Não foi possível interpretar a resposta da IA. Tente uma foto mais nítida.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (parsed?.error === 'not_a_medicine') {
      return new Response(
        JSON.stringify({
          error:
            'A imagem não parece ser uma embalagem de medicamento. Fotografe a caixa, frasco ou bula do remédio.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ medicine: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
