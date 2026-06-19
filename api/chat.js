const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `Eres un asistente de marketing digital especializado en análisis de campañas en redes sociales de La Ibérica AQP.
Responde ÚNICAMENTE con base en los datos de la campaña que se te proporcionan.
Sé conciso, directo y útil. Usa números exactos del dataset.
Responde siempre en español.`;

// Orden de preferencia: flash ligeros (mejor cuota gratis) antes que pro.
// Se cruza contra la lista REAL de modelos que la clave tiene disponibles.
const PREFERRED = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.5-pro',
  'gemini-pro-latest',
];

// Cache de la lista ordenada de candidatos (Fluid Compute reutiliza instancias)
let cachedCandidates = null;

async function listModels(apiVersion) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${API_KEY}&pageSize=200`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, '')); // "models/gemini-2.0-flash" -> "gemini-2.0-flash"
}

// Devuelve [{ model, apiVersion }, ...] ordenado por preferencia, solo modelos reales de la clave.
async function getCandidates() {
  if (cachedCandidates) return cachedCandidates;

  for (const apiVersion of ['v1beta', 'v1']) {
    const available = await listModels(apiVersion);
    if (!available.length) continue;

    const ordered = [];
    // 1) Los preferidos que existan, en orden
    for (const pref of PREFERRED) {
      if (available.includes(pref)) ordered.push(pref);
    }
    // 2) Cualquier otro "flash" no incluido aún
    for (const m of available) {
      if (m.includes('flash') && !ordered.includes(m)) ordered.push(m);
    }
    // 3) El resto (pro, etc.)
    for (const m of available) {
      if (!ordered.includes(m)) ordered.push(m);
    }

    cachedCandidates = ordered.map(model => ({ model, apiVersion }));
    return cachedCandidates;
  }
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });

  const { mensaje, historial = [], contexto = '' } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo "mensaje"' });

  let candidates;
  try {
    candidates = await getCandidates();
  } catch (e) {
    return res.status(502).json({ error: `No se pudo consultar la lista de modelos de Google: ${e.message}` });
  }
  if (!candidates.length) {
    return res.status(500).json({ error: 'La clave de Gemini no tiene ningún modelo con generateContent disponible. Verifica que sea una API key de Google AI Studio (https://aistudio.google.com/app/apikey).' });
  }

  const contents = [
    { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nDATOS DE LA CAMPAÑA:\n${contexto}` }] },
    { role: 'model', parts: [{ text: 'Entendido. Listo para responder sobre la campaña.' }] },
    ...historial.slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: mensaje }] },
  ];

  const body = JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
  });

  // Prueba cada candidato hasta que uno responda. Salta cuota agotada (429) y no-soportado (404).
  let lastError = '';
  let authError = null;
  for (const { model, apiVersion } of candidates) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${API_KEY}`;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await r.json();

      if (r.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
        return res.status(200).json({ respuesta: text, modelo: `${model} (${apiVersion})` });
      }

      lastError = data?.error?.message || `HTTP ${r.status}`;
      // 401/403 = clave inválida: no tiene sentido seguir probando
      if (r.status === 401 || r.status === 403) {
        authError = 'Clave de Gemini inválida o sin permisos. Verifica GEMINI_API_KEY en Vercel.';
        break;
      }
      // 429 (cuota) o 404 (no soportado): probar siguiente modelo
    } catch (err) {
      lastError = err.message;
    }
  }

  // Si todos fallaron, la lista de candidatos puede estar obsoleta: invalidar cache.
  cachedCandidates = null;

  if (authError) return res.status(403).json({ error: authError });
  return res.status(503).json({
    error: `Todos los modelos disponibles están con cuota agotada o no responden. Intenta de nuevo en unos minutos. (Último error: ${lastError})`,
  });
}
