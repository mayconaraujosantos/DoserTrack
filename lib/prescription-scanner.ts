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
  doctorName?: string;
}

const EXTRACTION_PROMPT = `Você é um assistente especializado em leitura de receitas médicas brasileiras.

Analise a imagem da receita e extraia TODOS os medicamentos prescritos.
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

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function stripMarkdownJson(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export async function scanPrescription(base64Image: string): Promise<PrescriptionData[]> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Chave da API não configurada. Adicione EXPO_PUBLIC_GEMINI_API_KEY no .env');

  console.log('[Scanner] Iniciando análise, tamanho base64:', base64Image.length);
  console.log('[Scanner] Endpoint:', GEMINI_URL);

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
        { text: EXTRACTION_PROMPT },
      ],
    }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  console.log('[Scanner] HTTP status:', response.status);

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('[Scanner] Erro da API:', JSON.stringify(errBody, null, 2));

    if (response.status === 429) {
      throw new Error('Limite de uso atingido (plano gratuito). Aguarde alguns minutos e tente novamente.');
    }
    if (response.status === 400) {
      throw new Error('Imagem inválida ou muito grande. Tente uma foto mais nítida.');
    }
    if (response.status === 403) {
      throw new Error('Chave de API inválida ou sem permissão para usar este modelo.');
    }
    throw new Error(`Erro da API Gemini (${response.status}). Tente novamente.`);
  }

  const data = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  console.log('[Scanner] Resposta completa:', JSON.stringify(data, null, 2));

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  const text = stripMarkdownJson(raw);

  console.log('[Scanner] Texto extraído:', text);

  try {
    const parsed = JSON.parse(text) as PrescriptionData | PrescriptionData[];
    const result = Array.isArray(parsed) ? parsed : [parsed];
    console.log('[Scanner] Parseado com sucesso:', result.length, 'medicamento(s)');
    return result;
  } catch (parseError) {
    console.error('[Scanner] Falha ao parsear JSON:', parseError, '| texto:', text);
    throw new Error('Não foi possível interpretar a receita. Verifique se a imagem está legível e tente novamente.');
  }
}
