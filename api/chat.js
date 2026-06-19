const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `Eres un asistente de marketing digital especializado en análisis de campañas en redes sociales de La Ibérica AQP.
Responde ÚNICAMENTE con base en los datos de la campaña que se te proporcionan.
Sé conciso, directo y útil. Usa números exactos del dataset.
Responde siempre en español.`;

// Orden de preferencia: flash (rápido/barato) antes que pro.
// Se cruza contra la lista REAL de modelos que la clave tiene disponibles.
const PREFERRED = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-1.5-pro',
  'gemini-pro-latest',
];

// Cache de modelos disponibles entre invocaciones (Fluid Compute reutiliza instancias)
let cachedModels = null;

async function listModels(apiVersion) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${API_KEY}&pageSize=200`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, '')); // "models/gemini-2.0-flash" -> "gemini-2.0-flash"
}

async function resolveModel() {
  if (cachedModels) return cachedModels;

  // v1beta suele exponer más modelos que v1
  for (const apiVersion of ['v1beta', 'v1']) {
    const available = await listModels(apiVersion);
    if (!available.length) continue;

    // 1) Elige según preferencia
    for (const pref of PREFERRED) {
      if (available.includes(pref)) {
        cachedModels = { model: pref, apiVersion };
        return cachedModels;
      }
    }
    // 2) Si ninguno de la lista preferida está, usa el primer "flash" disponible
    const anyFlash = available.find(m => m.includes('flash'));
    if (anyFlash) {
      cachedModels = { model: anyFlash, apiVersion };
      return cachedModels;
    }
    // 3) Último recurso: el primero que soporte generateContent
    cachedModels = { model: available[0], apiVersion };
    return cachedModels;
  }
  return null;
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

  let target;
  try {
    target = await resolveModel();
  } catch (e) {
    return res.status(502).json({ error: `No se pudo consultar la lista de modelos de Google: ${e.message}` });
  }
  if (!target) {
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

  const url = `https://generativelanguage.googleapis.com/${target.apiVersion}/models/${target.model}:generateContent?key=${API_KEY}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await r.json();

    if (r.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(sin respuesta)';
      return res.status(200).json({ respuesta: text, modelo: `${target.model} (${target.apiVersion})` });
    }

    // Si el modelo cacheado falla (p.ej. cuota agotada), invalida cache para reintentar otro
    cachedModels = null;
    const msg = data?.error?.message || `HTTP ${r.status}`;
    if (r.status === 401 || r.status === 403) {
      return res.status(r.status).json({ error: 'Clave de Gemini inválida o sin permisos. Verifica GEMINI_API_KEY en Vercel.' });
    }
    if (r.status === 429) {
      return res.status(429).json({ error: `Cuota agotada para el modelo ${target.model}. Intenta de nuevo en unos minutos.` });
    }
    return res.status(500).json({ error: `Error de Gemini (${target.model}): ${msg}` });
  } catch (err) {
    return res.status(500).json({ error: `Fallo de red al llamar a Gemini: ${err.message}` });
  }
}
