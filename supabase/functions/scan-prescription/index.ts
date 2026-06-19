import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `Você é um assistente especializado em leitura de receitas médicas brasileiras.

IMPORTANTE: Se a imagem NÃO for uma receita médica (foto de pessoa, objeto, paisagem, documento sem medicamentos, etc.), retorne APENAS este JSON e nada mais:
{"error": "not_a_prescription"}

Se for uma receita médica, analise a imagem e extraia TODOS os medicamentos prescritos.
Retorne APENAS um array JSON válido (sem markdown, sem bloco de código, sem texto extra) com esta estrutura:

[
  {
    "name": "Nome comercial do medicamento (sem concentração, sem forma farmacêutica)",
    "concentration": "Concentração completa (ex: '500mg', '5mg/mL + 10mg/mL')",
    "type": "drop|tablet|capsule|ml|injection|other",
    "quantity": número inteiro de unidades prescritas ou null,
    "instructions": "Instruções completas de uso",
    "frequencyHours": horas entre doses para intervalo fixo (8 para '8/8h', 12 para '12/12h', 24 para '1x ao dia em intervalo') — use SOMENTE quando a posologia for expressa como intervalo em horas, caso contrário null,
    "timesPerDay": número de doses por dia quando NÃO for intervalo de horas (1 para 'tomar 1 comprimido ao dia', 2 para 'manhã e noite') ou null,
    "timeHints": array com os descritores de horário encontrados na instrução, ex: ["manhã"], ["após jantar"], ["manhã", "noite"], ["em jejum"] — extraia literalmente do texto, array vazio [] se não houver,
    "timesPerWeek": número de doses por semana apenas para uso semanal (1 para '1x por semana', 2 para '2x por semana') ou null,
    "durationDays": dias de tratamento ou null se não especificado,
    "isContinuous": true se houver 'USO CONTÍNUO', 'uso permanente', 'por tempo indeterminado' ou similar, false caso contrário,
    "doctorName": "Nome do médico com CRM"
  }
]

Regras para o campo "type":
- "drop" → gotas, solução otológica, colírio, solução nasal
- "tablet" → comprimido, drágea
- "capsule" → cápsula, softgel
- "ml" → solução oral em mL, xarope, suspensão
- "injection" → injeção, ampola, frasco-ampola
- "other" → adesivo, creme, pomada, supositório, inalador e demais

Exemplos de mapeamento de frequência:
- "8/8hs" → frequencyHours: 8, timesPerDay: null
- "12/12h" → frequencyHours: 12, timesPerDay: null
- "1 comprimido pela manhã - USO CONTÍNUO" → frequencyHours: null, timesPerDay: 1, timeHints: ["manhã"], isContinuous: true
- "após o jantar - USO CONTÍNUO" → frequencyHours: null, timesPerDay: 1, timeHints: ["após jantar"], isContinuous: true
- "manhã e noite por 30 dias" → frequencyHours: null, timesPerDay: 2, timeHints: ["manhã", "noite"], durationDays: 30
- "1 vez por semana" → frequencyHours: null, timesPerWeek: 1, timesPerDay: null
- "2 vezes por semana" → frequencyHours: null, timesPerWeek: 2, timesPerDay: null

Liste todos os medicamentos encontrados na receita, um objeto por medicamento.`;

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
        maxOutputTokens: 2048,
        temperature: 0.1,
      },
    };

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      const status = geminiRes.status;
      let message = `Erro da API Gemini (${status}).`;
      if (status === 429)
        message = 'Limite de uso atingido. Aguarde alguns minutos e tente novamente.';
      if (status === 400) message = 'Imagem inválida ou muito grande. Tente uma foto mais nítida.';
      if (status === 403) message = 'Chave de API sem permissão para este modelo.';
      return new Response(JSON.stringify({ error: message, detail: errBody }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const text = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed) && parsed?.error === 'not_a_prescription') {
      return new Response(
        JSON.stringify({
          error:
            'A imagem não parece ser uma receita médica. Fotografe apenas receitas com medicamentos prescritos.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = Array.isArray(parsed) ? parsed : [parsed];

    return new Response(JSON.stringify({ medications: result }), {
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
